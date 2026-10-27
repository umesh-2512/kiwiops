import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261027001400_timezone_consistency.sql"), "utf8").toLowerCase();

describe("job scheduling timezone migration", () => {
  it("uses the trusted organization timezone and keeps a fixed search path", () => {
    expect(migration).toContain("from public.business_settings");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("at time zone v_timezone");
  });

  it("rejects daylight-saving gaps and overlaps", () => {
    expect(migration).toContain("does not exist in the organization timezone");
    expect(migration).toContain("is ambiguous in the organization timezone");
  });

  it("does not rewrite existing job schedules or broaden access", () => {
    expect(migration).not.toMatch(/update\s+public\.jobs/);
    expect(migration).not.toMatch(/alter\s+table/);
    expect(migration).toContain("revoke all on function private.parse_job_schedule(uuid, text) from public, anon, authenticated");
  });
});

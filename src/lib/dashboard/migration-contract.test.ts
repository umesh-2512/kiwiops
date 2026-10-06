import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261006001100_operational_dashboard.sql"), "utf8");

describe("operational dashboard migration contract", () => {
  it("restricts the summary to owner and admin memberships", () => {
    expect(migration).toContain("private.has_org_role(p_organization_id, array['owner', 'admin'])");
  });

  it("uses a security definer function with a fixed search path", () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/);
  });

  it("denies anon and PUBLIC while allowing authenticated callers", () => {
    expect(migration).toContain("revoke all on function public.get_operational_dashboard_summary(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.get_operational_dashboard_summary(uuid) to authenticated");
  });

  it("scopes every operational aggregate to the requested organization", () => {
    expect(migration.match(/organization_id = p_organization_id/g)?.length).toBeGreaterThanOrEqual(9);
  });

  it("excludes voided payments and uses organization-local dates", () => {
    expect(migration).toContain("p.voided_at is null");
    expect(migration).toContain("now() at time zone v_settings.timezone");
    expect(migration).toContain("p.paid_on >= v_month_start");
  });

  it("derives outstanding only from issued invoices and active payments", () => {
    expect(migration).toContain("i.status = 'sent'");
    expect(migration).toContain("greatest(i.total_cents - coalesce(pt.paid_cents, 0), 0)");
  });
});

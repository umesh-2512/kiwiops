import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const data = readFileSync(join(process.cwd(), "src/lib/insights/data.ts"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/(app)/insights/page.tsx"), "utf8");
const dashboard = readFileSync(join(process.cwd(), "src/app/(app)/page.tsx"), "utf8");

describe("Smart Insights application contract", () => {
  it("keeps the route server-rendered and uses the authenticated Supabase server client", () => {
    expect(data).toContain('import "server-only"');
    expect(data).toContain("await createClient()");
    expect(data).toContain('supabase.rpc("get_smart_insights"');
    expect(page).not.toContain('"use client"');
  });

  it("redirects technicians away from organization-wide insights", () => {
    expect(data).toContain('viewer.organization.role === "technician"');
    expect(data).toContain('redirect("/my-jobs")');
  });

  it("does not represent an RPC failure as all-clear", () => {
    expect(page).toContain("smartInsightPageState(null, true)");
    expect(page).toContain('state.kind === "error"');
    expect(page).toContain("No operational issues have been replaced with an all-clear message");
  });

  it("uses the same presentation builder for the page and dashboard preview", () => {
    expect(page).toContain("smartInsightPageState");
    expect(dashboard).toContain("buildSmartInsights(facts)");
    expect(dashboard).toContain("insights.slice(0, 3)");
  });
});

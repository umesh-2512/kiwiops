import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dataSource = readFileSync(join(process.cwd(), "src/lib/dashboard/data.ts"), "utf8");

describe("dashboard access and query contract", () => {
  it("keeps technicians on their assigned-job experience", () => {
    expect(dataSource).toContain('viewer.organization.role === "technician"');
    expect(dataSource).toContain('redirect("/my-jobs")');
  });

  it("scopes record queries to the authenticated organization", () => {
    expect(dataSource.match(/\.eq\("organization_id", organizationId\)/g)?.length).toBe(3);
  });

  it("limits and orders upcoming jobs and recent activity", () => {
    expect(dataSource).toContain('.order("scheduled_start_at", { ascending: true }).limit(5)');
    expect(dataSource).toContain('.order("created_at", { ascending: false }).limit(8)');
  });

  it("uses the explicit activity actor and job assignment relationships", () => {
    expect(dataSource).toContain("organization_members!activity_logs_actor_fk(display_name)");
    expect(dataSource).toContain("organization_members!job_assignments_member_fk(display_name)");
  });

  it("throws safe dashboard errors instead of substituting zero values", () => {
    expect(dataSource).toContain('throw new Error("Unable to load dashboard summary.")');
    expect(dataSource).toContain('throw new Error("Unable to load operational dashboard.")');
  });
});

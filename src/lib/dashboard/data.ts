import "server-only";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { organizationDayBounds } from "./timezone";
import type { DashboardActivity, DashboardData, DashboardJob, DashboardSummary } from "./types";

const jobColumns = "id,job_number,job_type,priority,status,scheduled_start_at,customers(first_name,last_name),job_assignments!job_assignments_job_fk(unassigned_at,organization_members!job_assignments_member_fk(display_name))";

function normalizeActivity(rows: unknown[]) {
  return rows.map((row) => {
    const value = row as Omit<DashboardActivity, "actor_name"> & { organization_members: { display_name: string } | Array<{ display_name: string }> | null };
    const actor = Array.isArray(value.organization_members) ? value.organization_members[0] : value.organization_members;
    return { id: value.id, action: value.action, summary: value.summary, entity_type: value.entity_type, entity_id: value.entity_id, metadata: value.metadata ?? {}, created_at: value.created_at, actor_name: actor?.display_name ?? null };
  });
}

export async function getOperationalDashboard(organizationId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const summaryResult = await supabase.rpc("get_operational_dashboard_summary", { p_organization_id: organizationId });
  if (summaryResult.error || !summaryResult.data?.[0]) throw new Error("Unable to load dashboard summary.");
  const summary = summaryResult.data[0] as DashboardSummary;
  const bounds = organizationDayBounds(summary.organization_today, summary.timezone);

  const [todayResult, upcomingResult, activityResult] = await Promise.all([
    supabase.from("jobs").select(jobColumns).eq("organization_id", organizationId).in("status", ["scheduled", "in_progress", "completed"]).gte("scheduled_start_at", bounds.start).lt("scheduled_start_at", bounds.end).order("scheduled_start_at", { ascending: true }).limit(12),
    supabase.from("jobs").select(jobColumns).eq("organization_id", organizationId).eq("status", "scheduled").gte("scheduled_start_at", bounds.end).order("scheduled_start_at", { ascending: true }).limit(5),
    supabase.from("activity_logs").select("id,action,summary,entity_type,entity_id,metadata,created_at,organization_members!activity_logs_actor_fk(display_name)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(8),
  ]);

  if (todayResult.error || upcomingResult.error || activityResult.error) throw new Error("Unable to load operational dashboard.");
  return {
    summary,
    todayJobs: (todayResult.data ?? []) as unknown as DashboardJob[],
    upcomingJobs: (upcomingResult.data ?? []) as unknown as DashboardJob[],
    activity: normalizeActivity(activityResult.data ?? []),
  };
}

export async function requireDashboardOfficeContext() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.organization) redirect("/onboarding");
  if (viewer.organization.role === "technician") redirect("/my-jobs");
  return { organization: viewer.organization, viewer };
}

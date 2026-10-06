import type { DashboardActivity, DashboardJob, DashboardSummary } from "./types";

export function assignedTechnicians(job: DashboardJob) {
  return job.job_assignments.filter((assignment) => !assignment.unassigned_at).map((assignment) => assignment.organization_members.display_name);
}

export function activityHref(activity: DashboardActivity) {
  const routes: Record<string, string> = { customer: "customers", enquiry: "enquiries", quote: "quotes", job: "jobs", invoice: "invoices" };
  if (routes[activity.entity_type]) return `/${routes[activity.entity_type]}/${activity.entity_id}`;
  const invoiceId = activity.entity_type === "payment" && typeof activity.metadata.invoice_id === "string" ? activity.metadata.invoice_id : null;
  return invoiceId ? `/invoices/${invoiceId}` : null;
}

export function attentionItems(summary: DashboardSummary) {
  return [
    summary.overdue_invoice_count ? { key: "overdue", count: summary.overdue_invoice_count, href: "/invoices?filter=overdue" } : null,
    summary.urgent_open_enquiries ? { key: "enquiries", count: summary.urgent_open_enquiries, href: "/enquiries" } : null,
    summary.unscheduled_jobs ? { key: "unscheduled", count: summary.unscheduled_jobs, href: "/jobs?status=unscheduled" } : null,
    summary.unassigned_scheduled_jobs ? { key: "unassigned", count: summary.unassigned_scheduled_jobs, href: "/jobs?status=scheduled" } : null,
    summary.quotes_awaiting_decision ? { key: "quotes", count: summary.quotes_awaiting_decision, href: "/quotes?status=sent" } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
}

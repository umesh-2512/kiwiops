export type DashboardSummary = {
  timezone: string;
  currency: string;
  organization_today: string;
  open_enquiries: number;
  active_jobs: number;
  quotes_awaiting_decision: number;
  outstanding_invoice_count: number;
  outstanding_cents: number;
  overdue_invoice_count: number;
  overdue_cents: number;
  paid_this_month_cents: number;
  urgent_open_enquiries: number;
  unscheduled_jobs: number;
  unassigned_scheduled_jobs: number;
  enquiry_new: number;
  enquiry_reviewing: number;
  quote_draft: number;
  quote_sent: number;
  quote_accepted: number;
};

export type DashboardJob = {
  id: string;
  job_number: string;
  job_type: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "scheduled" | "in_progress" | "completed";
  scheduled_start_at: string;
  customers: { first_name: string; last_name: string };
  job_assignments: Array<{
    unassigned_at: string | null;
    organization_members: { display_name: string };
  }>;
};

export type DashboardActivity = {
  id: string;
  action: string;
  summary: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
};

export type DashboardData = {
  summary: DashboardSummary;
  todayJobs: DashboardJob[];
  upcomingJobs: DashboardJob[];
  activity: DashboardActivity[];
};

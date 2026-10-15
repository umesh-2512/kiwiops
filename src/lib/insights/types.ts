export type SmartInsightFacts = {
  timezone: string;
  organization_today: string;
  currency: string;
  overdue_invoice_count: number;
  overdue_cents: number;
  oldest_overdue_due_date: string | null;
  urgent_open_enquiries: number;
  aged_high_open_enquiries: number;
  oldest_high_enquiry_date: string | null;
  unscheduled_jobs: number;
  oldest_unscheduled_job_date: string | null;
  unassigned_scheduled_jobs: number;
  oldest_unassigned_schedule_date: string | null;
  uninvoiced_completed_jobs: number;
  oldest_uninvoiced_completion_date: string | null;
  aged_sent_quotes: number;
  oldest_sent_quote_date: string | null;
};

export type SmartInsightSeverity = "critical" | "attention" | "opportunity";

export type SmartInsight = {
  key: "overdue-invoices" | "urgent-enquiries" | "high-enquiries" | "unscheduled-jobs" | "unassigned-jobs" | "uninvoiced-jobs" | "aged-quotes";
  severity: SmartInsightSeverity;
  priority: number;
  title: string;
  explanation: string;
  count: number;
  actionLabel: string;
  actionUrl: string;
};

export type SmartInsightPageState =
  | { kind: "error" }
  | { kind: "clear"; facts: SmartInsightFacts; insights: [] }
  | { kind: "active"; facts: SmartInsightFacts; insights: SmartInsight[] };

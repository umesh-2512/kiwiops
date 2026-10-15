import { formatMoney } from "../quotes/money";
import type { SmartInsight, SmartInsightFacts, SmartInsightPageState } from "./types";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

export function calendarAgeDays(dateKey: string | null, todayKey: string) {
  if (!dateKey) return null;
  const start = Date.parse(`${dateKey}T00:00:00Z`);
  const end = Date.parse(`${todayKey}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 86_400_000)) : null;
}

function ageCopy(dateKey: string | null, todayKey: string, label: string) {
  const days = calendarAgeDays(dateKey, todayKey);
  if (days === null) return label;
  return `${label} ${days} ${plural(days, "day")} ago.`;
}

export function buildSmartInsights(facts: SmartInsightFacts): SmartInsight[] {
  const insights: Array<SmartInsight | null> = [
    facts.overdue_invoice_count > 0 ? {
      key: "overdue-invoices", severity: "critical", priority: 1, count: facts.overdue_invoice_count,
      title: `${facts.overdue_invoice_count} ${plural(facts.overdue_invoice_count, "invoice is", "invoices are")} overdue`,
      explanation: `${formatMoney(facts.overdue_cents, facts.currency)} remains outstanding across overdue invoices.`,
      actionLabel: "View invoices", actionUrl: "/invoices?filter=overdue",
    } : null,
    facts.urgent_open_enquiries > 0 ? {
      key: "urgent-enquiries", severity: "critical", priority: 2, count: facts.urgent_open_enquiries,
      title: `${facts.urgent_open_enquiries} urgent ${plural(facts.urgent_open_enquiries, "enquiry needs", "enquiries need")} attention`,
      explanation: "These enquiries are still new or under review.",
      actionLabel: "View urgent enquiries", actionUrl: "/enquiries?priority=urgent",
    } : null,
    facts.aged_high_open_enquiries > 0 ? {
      key: "high-enquiries", severity: "attention", priority: 3, count: facts.aged_high_open_enquiries,
      title: `${facts.aged_high_open_enquiries} high-priority ${plural(facts.aged_high_open_enquiries, "enquiry needs", "enquiries need")} follow-up`,
      explanation: ageCopy(facts.oldest_high_enquiry_date, facts.organization_today, "The oldest arrived"),
      actionLabel: "View high-priority enquiries", actionUrl: "/enquiries?priority=high",
    } : null,
    facts.unscheduled_jobs > 0 ? {
      key: "unscheduled-jobs", severity: "attention", priority: 4, count: facts.unscheduled_jobs,
      title: `${facts.unscheduled_jobs} ${plural(facts.unscheduled_jobs, "job still needs", "jobs still need")} scheduling`,
      explanation: ageCopy(facts.oldest_unscheduled_job_date, facts.organization_today, "The oldest was created"),
      actionLabel: "Schedule jobs", actionUrl: "/jobs?status=unscheduled",
    } : null,
    facts.unassigned_scheduled_jobs > 0 ? {
      key: "unassigned-jobs", severity: "attention", priority: 5, count: facts.unassigned_scheduled_jobs,
      title: `${facts.unassigned_scheduled_jobs} scheduled ${plural(facts.unassigned_scheduled_jobs, "job has", "jobs have")} no technician`,
      explanation: "Assign an active technician before the work begins.",
      actionLabel: "Assign technicians", actionUrl: "/jobs?status=scheduled",
    } : null,
    facts.uninvoiced_completed_jobs > 0 ? {
      key: "uninvoiced-jobs", severity: "opportunity", priority: 6, count: facts.uninvoiced_completed_jobs,
      title: `${facts.uninvoiced_completed_jobs} completed ${plural(facts.uninvoiced_completed_jobs, "job is", "jobs are")} ready to invoice`,
      explanation: ageCopy(facts.oldest_uninvoiced_completion_date, facts.organization_today, "The oldest was completed"),
      actionLabel: "Create invoice", actionUrl: "/invoices/new",
    } : null,
    facts.aged_sent_quotes > 0 ? {
      key: "aged-quotes", severity: "attention", priority: 7, count: facts.aged_sent_quotes,
      title: `${facts.aged_sent_quotes} ${plural(facts.aged_sent_quotes, "quote has", "quotes have")} been waiting for a decision`,
      explanation: ageCopy(facts.oldest_sent_quote_date, facts.organization_today, "The oldest was sent"),
      actionLabel: "View sent quotes", actionUrl: "/quotes?status=sent",
    } : null,
  ];

  return insights.filter((insight): insight is SmartInsight => insight !== null).sort((a, b) => a.priority - b.priority);
}

export function smartInsightPageState(facts: SmartInsightFacts | null, failed = false): SmartInsightPageState {
  if (failed || !facts) return { kind: "error" };
  const insights = buildSmartInsights(facts);
  return insights.length ? { kind: "active", facts, insights } : { kind: "clear", facts, insights: [] };
}

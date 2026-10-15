import { describe, expect, it } from "vitest";
import { buildSmartInsights, calendarAgeDays, smartInsightPageState } from "./presentation";
import type { SmartInsightFacts } from "./types";

const emptyFacts: SmartInsightFacts = {
  timezone: "Pacific/Auckland", organization_today: "2026-10-07", currency: "NZD",
  overdue_invoice_count: 0, overdue_cents: 0, oldest_overdue_due_date: null,
  urgent_open_enquiries: 0, aged_high_open_enquiries: 0, oldest_high_enquiry_date: null,
  unscheduled_jobs: 0, oldest_unscheduled_job_date: null,
  unassigned_scheduled_jobs: 0, oldest_unassigned_schedule_date: null,
  uninvoiced_completed_jobs: 0, oldest_uninvoiced_completion_date: null,
  aged_sent_quotes: 0, oldest_sent_quote_date: null,
};

describe("Smart Insight presentation", () => {
  it("returns all seven grouped rules in deterministic priority order", () => {
    const insights = buildSmartInsights({
      ...emptyFacts,
      overdue_invoice_count: 2, overdue_cents: 65_425, oldest_overdue_due_date: "2026-09-20",
      urgent_open_enquiries: 1,
      aged_high_open_enquiries: 3, oldest_high_enquiry_date: "2026-10-04",
      unscheduled_jobs: 4, oldest_unscheduled_job_date: "2026-10-01",
      unassigned_scheduled_jobs: 2, oldest_unassigned_schedule_date: "2026-10-08",
      uninvoiced_completed_jobs: 1, oldest_uninvoiced_completion_date: "2026-10-05",
      aged_sent_quotes: 2, oldest_sent_quote_date: "2026-09-28",
    });
    expect(insights.map((insight) => insight.key)).toEqual(["overdue-invoices", "urgent-enquiries", "high-enquiries", "unscheduled-jobs", "unassigned-jobs", "uninvoiced-jobs", "aged-quotes"]);
    expect(insights.map((insight) => insight.priority)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(insights[0].title).toBe("2 invoices are overdue");
    expect(insights[0].explanation).toContain("$654.25");
  });

  it("uses only real supported destinations", () => {
    const insights = buildSmartInsights({ ...emptyFacts, overdue_invoice_count: 1, overdue_cents: 100, urgent_open_enquiries: 1, aged_high_open_enquiries: 1, unscheduled_jobs: 1, unassigned_scheduled_jobs: 1, uninvoiced_completed_jobs: 1, aged_sent_quotes: 1 });
    expect(insights.map((insight) => insight.actionUrl)).toEqual(["/invoices?filter=overdue", "/enquiries?priority=urgent", "/enquiries?priority=high", "/jobs?status=unscheduled", "/jobs?status=scheduled", "/invoices/new", "/quotes?status=sent"]);
  });

  it("groups each rule into one card regardless of its count", () => {
    const insights = buildSmartInsights({ ...emptyFacts, overdue_invoice_count: 12, overdue_cents: 99_999 });
    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ key: "overdue-invoices", count: 12 });
  });

  it("returns all-clear only after a successful zero-insight result", () => {
    expect(smartInsightPageState(emptyFacts).kind).toBe("clear");
    expect(smartInsightPageState(null, true).kind).toBe("error");
    expect(smartInsightPageState(null).kind).toBe("error");
  });

  it("returns active when at least one trusted fact triggers", () => {
    expect(smartInsightPageState({ ...emptyFacts, urgent_open_enquiries: 1 }).kind).toBe("active");
  });

  it("calculates organization-local calendar ages from date keys", () => {
    expect(calendarAgeDays("2026-09-30", "2026-10-07")).toBe(7);
    expect(calendarAgeDays("2026-10-06", "2026-10-07")).toBe(1);
  });
});

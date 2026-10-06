import { describe, expect, it } from "vitest";
import { activityHref, assignedTechnicians, attentionItems } from "./presentation";
import type { DashboardActivity, DashboardJob, DashboardSummary } from "./types";

const summary = { overdue_invoice_count: 0, urgent_open_enquiries: 0, unscheduled_jobs: 0, unassigned_scheduled_jobs: 0, quotes_awaiting_decision: 0 } as DashboardSummary;

describe("dashboard presentation", () => {
  it("returns an intentional empty attention list", () => {
    expect(attentionItems(summary)).toEqual([]);
  });

  it("orders deterministic attention rules by operational priority", () => {
    expect(attentionItems({ ...summary, overdue_invoice_count: 2, urgent_open_enquiries: 1, unscheduled_jobs: 3, unassigned_scheduled_jobs: 1, quotes_awaiting_decision: 4 }).map((item) => item.key)).toEqual(["overdue", "enquiries", "unscheduled", "unassigned", "quotes"]);
  });

  it("uses only active job assignments", () => {
    const job = { job_assignments: [{ unassigned_at: null, organization_members: { display_name: "Alex Morgan" } }, { unassigned_at: "2026-10-01", organization_members: { display_name: "Former Tech" } }] } as DashboardJob;
    expect(assignedTechnicians(job)).toEqual(["Alex Morgan"]);
  });

  it("links payment activity through its invoice metadata", () => {
    const activity = { id: "activity-id", action: "payment.recorded", summary: "Payment recorded", entity_type: "payment", entity_id: "payment-id", metadata: { invoice_id: "invoice-id" }, created_at: "2026-10-06T00:00:00Z", actor_name: "Owner" } satisfies DashboardActivity;
    expect(activityHref(activity)).toBe("/invoices/invoice-id");
  });
});

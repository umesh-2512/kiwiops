import { describe, expect, it } from "vitest";
import { activePaymentTotal, collectibleBalance, isActiveJob, isOpenEnquiry, isQuoteAwaitingDecision } from "./definitions";

describe("dashboard operational definitions", () => {
  it("counts only new and reviewing enquiries as open", () => {
    expect(["new", "reviewing", "quoted", "converted", "closed"].filter(isOpenEnquiry)).toEqual(["new", "reviewing"]);
  });

  it("counts only operationally active jobs", () => {
    expect(["unscheduled", "scheduled", "in_progress", "completed", "cancelled"].filter(isActiveJob)).toEqual(["unscheduled", "scheduled", "in_progress"]);
  });

  it("counts only sent quotes as awaiting a decision", () => {
    expect(["draft", "sent", "accepted", "rejected"].filter(isQuoteAwaitingDecision)).toEqual(["sent"]);
  });

  it("excludes voided payments and derives a partial balance", () => {
    const paid = activePaymentTotal([{ amount_cents: 3000, voided_at: null }, { amount_cents: 2000, voided_at: "2026-10-01T00:00:00Z" }]);
    expect(paid).toBe(3000);
    expect(collectibleBalance({ status: "sent", total_cents: 10000 }, paid)).toBe(7000);
  });

  it("excludes paid, draft, and void invoices from outstanding", () => {
    expect(collectibleBalance({ status: "paid", total_cents: 10000 }, 10000)).toBe(0);
    expect(collectibleBalance({ status: "draft", total_cents: 10000 }, 0)).toBe(0);
    expect(collectibleBalance({ status: "cancelled", total_cents: 10000 }, 0)).toBe(0);
  });
});

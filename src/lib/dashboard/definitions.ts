export const openEnquiryStatuses = ["new", "reviewing"] as const;
export const activeJobStatuses = ["unscheduled", "scheduled", "in_progress"] as const;

export function isOpenEnquiry(status: string) {
  return openEnquiryStatuses.includes(status as (typeof openEnquiryStatuses)[number]);
}

export function isActiveJob(status: string) {
  return activeJobStatuses.includes(status as (typeof activeJobStatuses)[number]);
}

export function isQuoteAwaitingDecision(status: string) {
  return status === "sent";
}

export function activePaymentTotal(payments: Array<{ amount_cents: number; voided_at: string | null }>) {
  return payments.filter((payment) => !payment.voided_at).reduce((total, payment) => total + payment.amount_cents, 0);
}

export function collectibleBalance(invoice: { status: string; total_cents: number }, paidCents: number) {
  if (invoice.status !== "sent") return 0;
  return Math.max(0, invoice.total_cents - paidCents);
}

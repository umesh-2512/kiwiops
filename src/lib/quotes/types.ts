export const quoteStatuses = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = typeof quoteStatuses[number];
export const quoteStatusLabels: Record<QuoteStatus, string> = { draft: "Draft", sent: "Issued", accepted: "Accepted", rejected: "Declined" };
export type QuoteCustomer = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; address_line_1?: string | null; address_line_2?: string | null; suburb?: string | null; city?: string | null; postcode?: string | null };
export type QuoteEnquiry = { id: string; category: string | null; description: string; status: string; customer_id?: string | null };
export type QuoteItem = { id: string; description: string; quantity: string | number; unit_price_cents: number; tax_rate: string | number; line_subtotal_cents: number; tax_cents: number; line_total_cents: number; position: number };
export type Quote = { id: string; organization_id: string; customer_id: string; enquiry_id: string | null; quote_number: string; status: QuoteStatus; issue_date: string; expiry_date: string; currency: string; notes: string | null; terms: string | null; subtotal_cents: number; tax_cents: number; total_cents: number; sent_at: string | null; accepted_at: string | null; rejected_at: string | null; created_at: string; updated_at: string; customers: QuoteCustomer; enquiries: QuoteEnquiry | null; quote_items?: QuoteItem[] };
export type QuoteActivity = { id: string; summary: string; created_at: string };
export const quoteCustomerName = (c: QuoteCustomer) => `${c.first_name} ${c.last_name}`.trim();

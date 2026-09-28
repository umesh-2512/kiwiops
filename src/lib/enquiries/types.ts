export const enquiryStatuses = ["new", "reviewing", "quoted", "converted", "closed"] as const;
export const enquiryPriorities = ["low", "medium", "high", "urgent"] as const;
export const enquirySources = ["phone", "email", "website", "walk_in", "referral", "other"] as const;
export type EnquiryStatus = typeof enquiryStatuses[number];
export type EnquiryPriority = typeof enquiryPriorities[number];
export type EnquirySource = typeof enquirySources[number];
export type EnquiryCustomer = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null };
export type Enquiry = { id: string; organization_id: string; customer_id: string | null; source: EnquirySource; description: string; category: string | null; priority: EnquiryPriority; status: EnquiryStatus; closed_at: string | null; created_at: string; updated_at: string; customers: EnquiryCustomer | null };
export type EnquiryActivity = { id: string; summary: string; created_at: string };
export const enquiryStatusLabels: Record<EnquiryStatus, string> = { new: "New", reviewing: "Reviewing", quoted: "Quoted", converted: "Converted", closed: "Closed" };
export const enquiryPriorityLabels: Record<EnquiryPriority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
export const enquirySourceLabels: Record<EnquirySource, string> = { phone: "Phone", email: "Email", website: "Website", walk_in: "Walk-in", referral: "Referral", other: "Other" };
export function enquiryHeading(enquiry: Pick<Enquiry, "category" | "description">) { return enquiry.category || enquiry.description.slice(0, 72); }
export function enquiryCustomerName(customer: EnquiryCustomer) { return `${customer.first_name} ${customer.last_name}`.trim(); }

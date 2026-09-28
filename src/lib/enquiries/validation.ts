import { enquiryPriorities, enquirySources, enquiryStatuses } from "./types";
export type EnquiryFieldErrors = Record<string, string[]>;
export type EnquiryActionState = { fieldErrors?: EnquiryFieldErrors; message?: string; status: "idle" | "error" | "success" };
export const initialEnquiryState: EnquiryActionState = { status: "idle" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function value(form: FormData, key: string) { const item = form.get(key); return typeof item === "string" ? item.trim() : ""; }
function add(errors: EnquiryFieldErrors, key: string, message: string) { errors[key] = [...(errors[key] ?? []), message]; }
export function validateEnquiry(form: FormData, includeStatus = false) {
  const data = { customerId: value(form, "customerId"), category: value(form, "category"), description: value(form, "description"), source: value(form, "source"), priority: value(form, "priority"), status: includeStatus ? value(form, "status") : "new" };
  const fieldErrors: EnquiryFieldErrors = {};
  if (!uuidPattern.test(data.customerId)) add(fieldErrors, "customerId", "Select an active customer.");
  if (!data.description) add(fieldErrors, "description", "Describe the requested work.");
  if (data.description.length > 5000) add(fieldErrors, "description", "Keep the description under 5,000 characters.");
  if (data.category.length > 100) add(fieldErrors, "category", "Keep the category under 100 characters.");
  if (!(enquirySources as readonly string[]).includes(data.source)) add(fieldErrors, "source", "Select a valid source.");
  if (!(enquiryPriorities as readonly string[]).includes(data.priority)) add(fieldErrors, "priority", "Select a valid priority.");
  if (!(enquiryStatuses as readonly string[]).includes(data.status)) add(fieldErrors, "status", "Select a valid status.");
  return { data, fieldErrors };
}
export function hasEnquiryErrors(errors: EnquiryFieldErrors) { return Object.keys(errors).length > 0; }
export function isEnquiryId(value: string) { return uuidPattern.test(value); }

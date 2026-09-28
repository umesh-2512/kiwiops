import { parseMoneyToCents, parseQuantityMilli } from "./money";
export type QuoteFieldErrors = Record<string, string[]>;
export type QuoteActionState = { fieldErrors?: QuoteFieldErrors; message?: string; status: "idle" | "error" | "success" };
export const initialQuoteState: QuoteActionState = { status: "idle" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (f: FormData, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };
const add = (e: QuoteFieldErrors, k: string, m: string) => { e[k] = [...(e[k] ?? []), m]; };
export function validateQuote(form: FormData) {
  const customerId = text(form, "customerId"); const enquiryId = text(form, "enquiryId"); const expiryDate = text(form, "expiryDate"); const notes = text(form, "notes"); const terms = text(form, "terms");
  const descriptions = form.getAll("description").map(String); const quantities = form.getAll("quantity").map(String); const prices = form.getAll("unitPrice").map(String);
  const fieldErrors: QuoteFieldErrors = {}; const items: { description: string; quantity: string; unit_price_cents: number }[] = [];
  if (!uuid.test(customerId)) add(fieldErrors, "customerId", "Select an active customer.");
  if (enquiryId && !uuid.test(enquiryId)) add(fieldErrors, "enquiryId", "Select a valid enquiry.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) add(fieldErrors, "expiryDate", "Choose a valid expiry date.");
  if (notes.length > 5000) add(fieldErrors, "notes", "Keep notes under 5,000 characters."); if (terms.length > 5000) add(fieldErrors, "terms", "Keep terms under 5,000 characters.");
  if (!descriptions.length || descriptions.length !== quantities.length || descriptions.length !== prices.length || descriptions.length > 100) add(fieldErrors, "items", "Add between 1 and 100 complete line items.");
  descriptions.forEach((raw, i) => { const description = raw.trim(); const quantityMilli = parseQuantityMilli(quantities[i] ?? ""); const cents = parseMoneyToCents(prices[i] ?? ""); if (!description || description.length > 500 || quantityMilli === null || cents === null) add(fieldErrors, "items", `Line ${i + 1} has an invalid description, quantity, or price.`); else items.push({ description, quantity: (quantityMilli / 1000).toFixed(3), unit_price_cents: cents }); });
  return { data: { customerId, enquiryId: enquiryId || null, expiryDate, notes, terms, items }, fieldErrors };
}
export const hasQuoteErrors = (e: QuoteFieldErrors) => Object.keys(e).length > 0;
export const isQuoteId = (value: string) => uuid.test(value);

import { enquiryPriorities, enquiryStatuses, type EnquiryPriority, type EnquiryStatus } from "./types";
export const ENQUIRY_PAGE_SIZE = 20;
type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
export function normalizeEnquirySearch(v: string | string[] | undefined) { return (first(v) ?? "").trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100); }
export function parseEnquiryListParams(raw: Raw) {
  const page = Number.parseInt(first(raw.page) ?? "1", 10); const status = first(raw.status); const priority = first(raw.priority);
  return { page: Number.isSafeInteger(page) && page > 0 ? page : 1, query: normalizeEnquirySearch(raw.q), status: (enquiryStatuses as readonly string[]).includes(status ?? "") ? status as EnquiryStatus : "all" as const, priority: (enquiryPriorities as readonly string[]).includes(priority ?? "") ? priority as EnquiryPriority : "all" as const };
}
export function enquiryListHref(p: { page?: number; query?: string; status?: EnquiryStatus | "all"; priority?: EnquiryPriority | "all" }) { const s = new URLSearchParams(); if (p.query) s.set("q", p.query); if (p.status && p.status !== "all") s.set("status", p.status); if (p.priority && p.priority !== "all") s.set("priority", p.priority); if (p.page && p.page > 1) s.set("page", String(p.page)); return s.size ? `/enquiries?${s}` : "/enquiries"; }

import { quoteStatuses, type QuoteStatus } from "./types";
export const QUOTE_PAGE_SIZE = 20;
type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
export function normalizeQuoteSearch(v: string | string[] | undefined) { return (first(v) ?? "").trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100); }
export function parseQuoteListParams(raw: Raw) { const page = Number.parseInt(first(raw.page) ?? "1", 10); const status = first(raw.status); return { page: Number.isSafeInteger(page) && page > 0 ? page : 1, query: normalizeQuoteSearch(raw.q), status: (quoteStatuses as readonly string[]).includes(status ?? "") ? status as QuoteStatus : "all" as const }; }
export function quoteListHref(p: { page?: number; query?: string; status?: QuoteStatus | "all" }) { const s = new URLSearchParams(); if (p.query) s.set("q", p.query); if (p.status && p.status !== "all") s.set("status", p.status); if (p.page && p.page > 1) s.set("page", String(p.page)); return s.size ? `/quotes?${s}` : "/quotes"; }

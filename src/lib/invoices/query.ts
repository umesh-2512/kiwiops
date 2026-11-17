export const INVOICE_PAGE_SIZE = 25;

export const invoiceListFilters = ["all", "draft", "unpaid", "partial", "paid", "overdue", "void"] as const;
export type InvoiceListFilter = (typeof invoiceListFilters)[number];

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeInvoiceSearch(value: string | string[] | undefined) {
  return (first(value) ?? "")
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function parseInvoiceListParams(raw: RawSearchParams) {
  const parsedPage = Number(first(raw.page) ?? "1");
  const rawFilter = first(raw.filter) ?? "all";

  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 1000000 ? parsedPage : 1,
    query: normalizeInvoiceSearch(raw.q),
    filter: (invoiceListFilters.includes(rawFilter as InvoiceListFilter) ? rawFilter : "all") as InvoiceListFilter,
  };
}

export function invoiceListHref({
  page,
  query,
  filter,
}: {
  page?: number;
  query?: string;
  filter?: InvoiceListFilter;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter && filter !== "all") params.set("filter", filter);
  if (page && page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/invoices?${suffix}` : "/invoices";
}

import type { CustomerStatus } from "./types";

export const CUSTOMER_PAGE_SIZE = 20;

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeCustomerSearch(value: string | string[] | undefined) {
  return (first(value) ?? "")
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function parseCustomerListParams(params: RawSearchParams) {
  const parsedPage = Number.parseInt(first(params.page) ?? "1", 10);
  const rawStatus = first(params.status);

  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    query: normalizeCustomerSearch(params.q),
    status: (rawStatus === "archived" ? "archived" : "active") as CustomerStatus,
  };
}

export function customerListHref({
  page,
  query,
  status,
}: {
  page?: number;
  query?: string;
  status?: CustomerStatus;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status === "archived") params.set("status", "archived");
  if (page && page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/customers?${suffix}` : "/customers";
}

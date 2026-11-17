import { describe, expect, it } from "vitest";
import { INVOICE_PAGE_SIZE, invoiceListHref, normalizeInvoiceSearch, parseInvoiceListParams } from "./query";

describe("invoice list query", () => {
  it("uses a default database page size of 25", () => {
    expect(INVOICE_PAGE_SIZE).toBe(25);
  });

  it("normalizes invalid URL values", () => {
    expect(parseInvoiceListParams({ page: "-1", filter: "secret", q: "  INV,(1) " })).toEqual({
      page: 1,
      filter: "all",
      query: "INV 1",
    });
    expect(parseInvoiceListParams({ page: "2oops" }).page).toBe(1);
    expect(parseInvoiceListParams({ page: "1000001" }).page).toBe(1);
  });

  it("constrains repeated and oversized search values", () => {
    expect(normalizeInvoiceSearch(["  Daniel  ", "ignored"])).toBe("Daniel");
    expect(normalizeInvoiceSearch("x".repeat(120))).toHaveLength(100);
  });

  it("preserves search, state, and page in pagination URLs", () => {
    expect(invoiceListHref({ page: 2, query: "Daniel", filter: "overdue" })).toBe(
      "/invoices?q=Daniel&filter=overdue&page=2",
    );
  });

  it("resets pagination when a search or filter form is applied", () => {
    expect(invoiceListHref({ query: "INV-25", filter: "partial" })).toBe(
      "/invoices?q=INV-25&filter=partial",
    );
  });

  it("omits default state from clean URLs", () => {
    expect(invoiceListHref({ page: 1, query: "", filter: "all" })).toBe("/invoices");
  });
});

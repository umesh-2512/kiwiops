import { describe, expect, it } from "vitest";
import { parseQuoteListParams, quoteListHref } from "./query";
describe("quote query", () => {
  it("normalizes filters", () => expect(parseQuoteListParams({ q: "  Dan,(iel) ", status: "sent", page: "2" })).toEqual({ query: "Dan iel", status: "sent", page: 2 }));
  it("defaults invalid values", () => expect(parseQuoteListParams({ status: "expired", page: "0" })).toEqual({ query: "", status: "all", page: 1 }));
  it("preserves list state", () => expect(quoteListHref({ query: "Daniel", status: "draft", page: 2 })).toBe("/quotes?q=Daniel&status=draft&page=2"));
});

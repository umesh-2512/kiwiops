import { describe, expect, it } from "vitest";
import { enquiryListHref, normalizeEnquirySearch, parseEnquiryListParams } from "./query";
describe("enquiry list parameters", () => {
  it("normalizes filter punctuation", () => { expect(normalizeEnquirySearch(" green,(pool) ")).toBe("green pool"); });
  it("defaults invalid filters and pages", () => { expect(parseEnquiryListParams({ page: "0", priority: "critical", status: "lost" })).toEqual({ page: 1, query: "", priority: "all", status: "all" }); });
  it("preserves URL state", () => { expect(enquiryListHref({ page: 2, query: "pump", priority: "urgent", status: "new" })).toBe("/enquiries?q=pump&status=new&priority=urgent&page=2"); });
});

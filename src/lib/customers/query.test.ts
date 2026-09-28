import { describe, expect, it } from "vitest";
import { customerListHref, normalizeCustomerSearch, parseCustomerListParams } from "./query";

describe("customer list parameters", () => {
  it("normalizes unsafe search filter punctuation", () => {
    expect(normalizeCustomerSearch("  Smith,(email)  ")).toBe("Smith email");
  });

  it("uses safe defaults for invalid status and pagination", () => {
    expect(parseCustomerListParams({ page: "-8", status: "deleted" })).toEqual({
      page: 1,
      query: "",
      status: "active",
    });
  });

  it("preserves useful state in generated URLs", () => {
    expect(customerListHref({ page: 3, query: "ana", status: "archived" })).toBe(
      "/customers?q=ana&status=archived&page=3",
    );
  });
});

import { describe, expect, it } from "vitest";
import { isQuoteExpired, quoteDocumentParties } from "./presentation";
import type { Quote, QuoteBusinessDetails } from "./types";

function quote(status: Quote["status"]): Quote {
  return {
    id: "quote-id",
    organization_id: "organization-id",
    customer_id: "customer-id",
    enquiry_id: null,
    quote_number: "Q-2026-0001",
    status,
    issue_date: "2026-10-15",
    expiry_date: "2026-11-14",
    currency: "NZD",
    notes: null,
    terms: null,
    subtotal_cents: 10000,
    tax_cents: 1500,
    total_cents: 11500,
    sent_at: status === "draft" ? null : "2026-10-15T01:00:00Z",
    accepted_at: null,
    rejected_at: null,
    created_at: "2026-10-15T00:00:00Z",
    updated_at: "2026-10-15T01:00:00Z",
    customer_name_snapshot: "Issued Customer",
    customer_email_snapshot: "issued-customer@example.test",
    customer_phone_snapshot: "021 000 0001",
    billing_address_line_1_snapshot: "1 Issued Street",
    billing_address_line_2_snapshot: null,
    billing_suburb_snapshot: "Takapuna",
    billing_city_snapshot: "Auckland",
    billing_postcode_snapshot: "0622",
    business_name_snapshot: "Issued Kiwi Services",
    business_email_snapshot: "issued-business@example.test",
    business_phone_snapshot: "09 000 0001",
    business_address_line_1_snapshot: "2 Business Road",
    business_address_line_2_snapshot: null,
    business_suburb_snapshot: "Albany",
    business_city_snapshot: "Auckland",
    business_postcode_snapshot: "0632",
    business_gst_number_snapshot: "123-456-789",
    business_gst_registered_snapshot: true,
    tax_rate_snapshot: 15,
    customers: {
      id: "customer-id",
      first_name: "Current",
      last_name: "Customer",
      email: "current-customer@example.test",
      phone: "021 999 9999",
      address_line_1: "99 Current Street",
      address_line_2: null,
      suburb: "Devonport",
      city: "Auckland",
      postcode: "0624",
    },
    enquiries: null,
  };
}

const liveBusiness: QuoteBusinessDetails = {
  business_name: "Current Kiwi Services",
  business_email: "current-business@example.test",
  business_phone: "09 999 9999",
  address_line_1: "88 Current Road",
  address_line_2: null,
  suburb: "Newmarket",
  city: "Auckland",
  postcode: "1023",
  gst_number: "987-654-321",
  gst_registered: true,
  tax_rate: 15,
};

describe("quote document parties", () => {
  it("uses the organization calendar date for expiry", () => {
    expect(isQuoteExpired("sent", "2026-01-02", "2026-01-01")).toBe(false);
    expect(isQuoteExpired("sent", "2026-01-01", "2026-01-02")).toBe(true);
    expect(isQuoteExpired("accepted", "2026-01-01", "2026-01-02")).toBe(false);
  });
  it("uses current customer and business details for drafts", () => {
    const parties = quoteDocumentParties(quote("draft"), liveBusiness);
    expect(parties.customer.name).toBe("Current Customer");
    expect(parties.customer.address[0]).toBe("99 Current Street");
    expect(parties.business.name).toBe("Current Kiwi Services");
    expect(parties.business.address[0]).toBe("88 Current Road");
  });

  it("uses only captured customer details after issue", () => {
    const parties = quoteDocumentParties(quote("sent"), liveBusiness);
    expect(parties.customer.name).toBe("Issued Customer");
    expect(parties.customer.email).toBe("issued-customer@example.test");
    expect(parties.customer.address[0]).toBe("1 Issued Street");
    expect(JSON.stringify(parties.customer)).not.toContain("Current");
  });

  it("uses only captured business details after issue", () => {
    const parties = quoteDocumentParties(quote("accepted"), liveBusiness);
    expect(parties.business.name).toBe("Issued Kiwi Services");
    expect(parties.business.email).toBe("issued-business@example.test");
    expect(parties.business.gstNumber).toBe("123-456-789");
    expect(JSON.stringify(parties.business)).not.toContain("Current");
  });

  it("does not fall back to mutable records when an optional snapshot is missing", () => {
    const issued = quote("rejected");
    issued.customer_email_snapshot = null;
    issued.business_phone_snapshot = null;
    const parties = quoteDocumentParties(issued, liveBusiness);
    expect(parties.customer.email).toBeNull();
    expect(parties.business.phone).toBeNull();
  });
});

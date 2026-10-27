import type { Quote, QuoteBusinessDetails } from "./types";
import { quoteCustomerName } from "./types";

export type QuoteDocumentParty = {
  address: Array<string | null | undefined>;
  email: string | null;
  name: string;
  phone: string | null;
};

export type QuoteDocumentBusiness = QuoteDocumentParty & {
  gstNumber: string | null;
  gstRegistered: boolean;
  taxRate: string | number | null;
};

export function quoteDisplayCustomerName(quote: Quote) {
  return quote.status === "draft"
    ? quoteCustomerName(quote.customers)
    : quote.customer_name_snapshot || "Customer details unavailable";
}

export function quoteDocumentParties(
  quote: Quote,
  liveBusiness: QuoteBusinessDetails | null,
): { business: QuoteDocumentBusiness; customer: QuoteDocumentParty } {
  if (quote.status === "draft") {
    if (!liveBusiness) throw new Error("Draft quote business details are required.");
    return {
      business: {
        address: [liveBusiness.address_line_1, liveBusiness.address_line_2, liveBusiness.suburb, liveBusiness.city, liveBusiness.postcode],
        email: liveBusiness.business_email,
        gstNumber: liveBusiness.gst_number,
        gstRegistered: liveBusiness.gst_registered,
        name: liveBusiness.business_name,
        phone: liveBusiness.business_phone,
        taxRate: liveBusiness.tax_rate,
      },
      customer: {
        address: [quote.customers.address_line_1, quote.customers.address_line_2, quote.customers.suburb, quote.customers.city, quote.customers.postcode],
        email: quote.customers.email,
        name: quoteCustomerName(quote.customers),
        phone: quote.customers.phone,
      },
    };
  }

  return {
    business: {
      address: [quote.business_address_line_1_snapshot, quote.business_address_line_2_snapshot, quote.business_suburb_snapshot, quote.business_city_snapshot, quote.business_postcode_snapshot],
      email: quote.business_email_snapshot,
      gstNumber: quote.business_gst_number_snapshot,
      gstRegistered: quote.business_gst_registered_snapshot ?? false,
      name: quote.business_name_snapshot || "Business details unavailable",
      phone: quote.business_phone_snapshot,
      taxRate: quote.tax_rate_snapshot,
    },
    customer: {
      address: [quote.billing_address_line_1_snapshot, quote.billing_address_line_2_snapshot, quote.billing_suburb_snapshot, quote.billing_city_snapshot, quote.billing_postcode_snapshot],
      email: quote.customer_email_snapshot,
      name: quote.customer_name_snapshot || "Customer details unavailable",
      phone: quote.customer_phone_snapshot,
    },
  };
}

import { describe, expect, it } from "vitest";
import { hasSettingsErrors, isValidNzIrdNumber, normalizeNzIrdNumber, validateBusinessSettings } from "./validation";

function validForm() {
  const form = new FormData();
  Object.entries({ legalName: "Southern Pools Limited", tradingName: "Southern Pools", businessEmail: "accounts@example.co.nz", addressLine1: "1 Queen Street", city: "Auckland", postcode: "1010", gstStatus: "registered", gstNumber: "49-091-850", currency: "NZD", timezone: "Pacific/Auckland", paymentTerms: "14", expectedUpdatedAt: "2026-11-24T00:00:00Z" }).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("business settings validation", () => {
  it("validates and normalizes an Inland Revenue GST number", () => {
    expect(isValidNzIrdNumber("49-091-850")).toBe(true);
    expect(normalizeNzIrdNumber("49-091-850")).toBe("049091850");
    expect(isValidNzIrdNumber("123-456-789")).toBe(false);
  });

  it("accepts complete GST-registered settings", () => {
    const result = validateBusinessSettings(validForm());
    expect(hasSettingsErrors(result.fieldErrors)).toBe(false);
    expect(result.data.gstRegistered).toBe(true);
  });

  it("accepts a non-GST business without a GST number", () => {
    const form = validForm();
    form.set("gstStatus", "not_registered");
    form.delete("gstNumber");
    const result = validateBusinessSettings(form);
    expect(hasSettingsErrors(result.fieldErrors)).toBe(false);
    expect(result.data.gstNumber).toBeNull();
  });

  it("rejects missing required fields and unsupported financial settings", () => {
    const form = validForm();
    form.set("businessEmail", "bad"); form.set("postcode", "101"); form.set("currency", "AUD"); form.set("paymentTerms", "366");
    const result = validateBusinessSettings(form);
    expect(result.fieldErrors.businessEmail).toBeDefined();
    expect(result.fieldErrors.postcode).toBeDefined();
    expect(result.fieldErrors.currency).toBeDefined();
    expect(result.fieldErrors.paymentTerms).toBeDefined();
  });
});

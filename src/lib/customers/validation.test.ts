import { describe, expect, it } from "vitest";
import { customerDisplayName } from "./types";
import { validateCustomer } from "./validation";

function validForm() {
  const form = new FormData();
  form.set("firstName", "  Ana ");
  form.set("lastName", " Patel  ");
  form.set("email", " ANA@EXAMPLE.COM ");
  form.set("phone", "+64 21 123 4567");
  return form;
}

describe("customer validation", () => {
  it("trims fields and normalizes email", () => {
    const result = validateCustomer(validForm());
    expect(result.fieldErrors).toEqual({});
    expect(result.data).toMatchObject({ firstName: "Ana", lastName: "Patel", email: "ana@example.com" });
  });

  it("rejects missing identity and malformed contact values", () => {
    const form = new FormData();
    form.set("email", "not-an-email");
    form.set("phone", "call me");
    const result = validateCustomer(form);
    expect(result.fieldErrors.firstName).toBeDefined();
    expect(result.fieldErrors.lastName).toBeDefined();
    expect(result.fieldErrors.email).toBeDefined();
    expect(result.fieldErrors.phone).toBeDefined();
  });
});

describe("customer display name", () => {
  it("uses the same first and last name format everywhere", () => {
    expect(customerDisplayName({ first_name: "Ana", last_name: "Patel" })).toBe("Ana Patel");
  });
});

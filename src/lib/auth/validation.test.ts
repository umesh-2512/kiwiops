import { describe, expect, it } from "vitest";
import {
  hasFieldErrors,
  validateBusinessName,
  validateLogin,
  validateSignup,
} from "./validation";

describe("authentication validation", () => {
  it("accepts a complete signup submission", () => {
    const form = new FormData();
    form.set("firstName", "Aroha");
    form.set("lastName", "Wilson");
    form.set("email", "aroha@example.co.nz");
    form.set("password", "kiwi-ops-2026");
    form.set("confirmPassword", "kiwi-ops-2026");

    const result = validateSignup(form);
    expect(hasFieldErrors(result.fieldErrors)).toBe(false);
    expect(result.data.email).toBe("aroha@example.co.nz");
  });

  it("rejects weak and mismatched passwords", () => {
    const form = new FormData();
    form.set("firstName", "A");
    form.set("lastName", "W");
    form.set("email", "not-an-email");
    form.set("password", "short");
    form.set("confirmPassword", "different");

    const result = validateSignup(form);
    expect(result.fieldErrors.firstName).toBeDefined();
    expect(result.fieldErrors.email).toBeDefined();
    expect(result.fieldErrors.password).toHaveLength(2);
    expect(result.fieldErrors.confirmPassword).toBeDefined();
  });

  it("requires login credentials", () => {
    const result = validateLogin(new FormData());
    expect(result.fieldErrors.email).toBeDefined();
    expect(result.fieldErrors.password).toBeDefined();
  });

  it("trims and validates a business name", () => {
    const form = new FormData();
    form.set("businessName", "  Southern Pools & Spa Ltd  ");
    const result = validateBusinessName(form);
    expect(result.data.businessName).toBe("Southern Pools & Spa Ltd");
    expect(hasFieldErrors(result.fieldErrors)).toBe(false);
  });
});

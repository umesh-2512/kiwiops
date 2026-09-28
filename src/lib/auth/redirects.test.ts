import { describe, expect, it } from "vitest";
import { isPublicAuthPath, safeAppRedirect } from "./redirects";

describe("authentication redirects", () => {
  it("allows only known internal application destinations", () => {
    expect(safeAppRedirect("/jobs")).toBe("/jobs");
    expect(safeAppRedirect("%2Finvoices")).toBe("/invoices");
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(safeAppRedirect("https://example.com")).toBe("/");
    expect(safeAppRedirect("//example.com")).toBe("/");
    expect(safeAppRedirect("/unknown")).toBe("/");
  });

  it("keeps only login, signup, and auth callbacks public", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/signup")).toBe(true);
    expect(isPublicAuthPath("/auth/confirm")).toBe(true);
    expect(isPublicAuthPath("/onboarding")).toBe(false);
    expect(isPublicAuthPath("/customers")).toBe(false);
  });
});

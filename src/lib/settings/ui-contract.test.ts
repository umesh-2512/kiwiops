import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const form = readFileSync(resolve(process.cwd(), "src/components/settings/business-settings-form.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("business settings UI contract", () => {
  it("provides labeled GST choices, readiness status, and save feedback", () => {
    expect(form).toContain("Is this business GST registered?");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain('role={state.status === "error" ? "alert" : "status"}');
  });

  it("protects unsaved edits and keeps administrator access read-only", () => {
    expect(form).toContain('window.addEventListener("beforeunload"');
    expect(form).toContain("Only the workspace owner can change them");
    expect(form).toContain("disabled={!canEdit || pending}");
  });

  it("has a single-column mobile layout", () => {
    expect(css).toContain("@media(max-width:760px)");
    expect(css).toContain(".settings-fields-two,.settings-fields-three{grid-template-columns:1fr}");
  });
});

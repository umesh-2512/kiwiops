import { describe, expect, it } from "vitest";
import { enquiryHeading } from "./types";
import { validateEnquiry } from "./validation";
function form() { const f = new FormData(); f.set("customerId", "123e4567-e89b-42d3-a456-426614174000"); f.set("description", "  Pump is making a noise. "); f.set("source", "phone"); f.set("priority", "high"); return f; }
describe("enquiry validation", () => {
  it("trims valid data", () => { const r = validateEnquiry(form()); expect(r.fieldErrors).toEqual({}); expect(r.data.description).toBe("Pump is making a noise."); });
  it("rejects invalid constrained values", () => { const f = form(); f.set("priority", "critical"); f.set("source", "chat"); expect(validateEnquiry(f).fieldErrors).toMatchObject({ priority: expect.any(Array), source: expect.any(Array) }); });
  it("validates status during editing", () => { const f = form(); f.set("status", "deleted"); expect(validateEnquiry(f, true).fieldErrors.status).toBeDefined(); });
});
describe("enquiry heading", () => { it("prefers category and falls back to description", () => { expect(enquiryHeading({ category: "Pump repair", description: "Noise" })).toBe("Pump repair"); expect(enquiryHeading({ category: null, description: "Noise" })).toBe("Noise"); }); });

import { describe, expect, it } from "vitest";
import { validateQuote } from "./validation";
const id = "00000000-0000-4000-8000-000000000001";
describe("quote validation", () => {
  it("accepts a valid quote without browser totals", () => { const f = new FormData(); f.set("customerId", id); f.set("expiryDate", "2026-10-29"); f.append("description", "Inspection"); f.append("quantity", "1.5"); f.append("unitPrice", "95.50"); const r = validateQuote(f); expect(r.fieldErrors).toEqual({}); expect(r.data.items).toEqual([{ description: "Inspection", quantity: "1.500", unit_price_cents: 9550 }]); expect(r.data).not.toHaveProperty("total"); });
  it("rejects invalid identity and financial lines", () => { const f = new FormData(); f.set("customerId", "bad"); f.set("expiryDate", "soon"); f.append("description", ""); f.append("quantity", "0"); f.append("unitPrice", "9.999"); expect(Object.keys(validateQuote(f).fieldErrors).sort()).toEqual(["customerId", "expiryDate", "items"]); });
});

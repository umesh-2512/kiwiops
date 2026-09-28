import { describe, expect, it } from "vitest";
import { calculateLine, formatMoney, parseMoneyToCents, parseQuantityMilli } from "./money";

describe("quote money", () => {
  it.each([["95", 9500], ["95.5", 9550], ["95.50", 9550], ["0", 0], ["0.01", 1]])("parses %s", (input, cents) => expect(parseMoneyToCents(input)).toBe(cents));
  it.each(["", "-1", "1.234", "01.00", "1,000", "abc"])("rejects malformed money %s", input => expect(parseMoneyToCents(input)).toBeNull());
  it.each([["1", 1000], ["1.5", 1500], ["0.001", 1]])("parses quantity %s", (input, milli) => expect(parseQuantityMilli(input)).toBe(milli));
  it.each(["0", "-1", "1.2345", "01"])("rejects quantity %s", input => expect(parseQuantityMilli(input)).toBeNull());
  it("calculates multiple lines and GST with database-equivalent positive rounding", () => {
    const lines = [[1000, 9500], [1000, 18000], [1000, 12000]].map(([q, p]) => calculateLine(q, p));
    expect(lines.reduce((sum, line) => sum + line.subtotalCents, 0)).toBe(39500);
    expect(lines.reduce((sum, line) => sum + line.taxCents, 0)).toBe(5925);
    expect(lines.reduce((sum, line) => sum + line.totalCents, 0)).toBe(45425);
    expect(calculateLine(500, 1)).toEqual({ subtotalCents: 1, taxCents: 0, totalCents: 1 });
  });
  it("formats NZD", () => expect(formatMoney(45425)).toContain("454.25"));
});

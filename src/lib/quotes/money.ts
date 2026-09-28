export function parseMoneyToCents(input: string): number | null {
  const value = input.trim();
  if (!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 99_999_999 ? cents : null;
}

export function parseQuantityMilli(input: string): number | null {
  const value = input.trim();
  if (!/^(0|[1-9]\d{0,5})(\.\d{1,3})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  return Number.isSafeInteger(milli) && milli > 0 ? milli : null;
}

export function calculateLine(quantityMilli: number, unitPriceCents: number, taxRate = 15) {
  const subtotalCents = Number((BigInt(quantityMilli) * BigInt(unitPriceCents) + BigInt(500)) / BigInt(1000));
  const rateUnits = BigInt(Math.round(taxRate * 10_000));
  const taxCents = Number((BigInt(subtotalCents) * rateUnits + BigInt(500_000)) / BigInt(1_000_000));
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function formatMoney(cents: number, currency = "NZD") {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(cents / 100);
}

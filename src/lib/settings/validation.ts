export type SettingsFieldErrors = Record<string, string[]>;
export type SettingsActionState = {
  fieldErrors?: SettingsFieldErrors;
  message?: string;
  status: "idle" | "error" | "success";
};
export const initialSettingsState: SettingsActionState = { status: "idle" };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timezonePattern = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/;

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function error(errors: SettingsFieldErrors, key: string, message: string) {
  errors[key] = [...(errors[key] ?? []), message];
}
export function normalizeNzIrdNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? `0${digits}` : digits;
}

export function isValidNzIrdNumber(value: string) {
  const digits = normalizeNzIrdNumber(value);
  if (!/^\d{9}$/.test(digits)) return false;
  const number = Number(digits);
  if (number < 10_000_000 || number > 200_000_000) return false;
  const values = [...digits].map(Number);
  const calculate = (weights: number[]) => {
    const remainder = weights.reduce((sum, weight, index) => sum + values[index] * weight, 0) % 11;
    return remainder === 0 ? 0 : 11 - remainder;
  };
  let check = calculate([3, 2, 7, 6, 5, 4, 3, 2]);
  if (check === 10) check = calculate([7, 4, 3, 2, 5, 2, 7, 6]);
  return check >= 0 && check <= 9 && check === values[8];
}

export function validateBusinessSettings(form: FormData) {
  const data = {
    legalName: text(form, "legalName"), tradingName: text(form, "tradingName"),
    businessEmail: text(form, "businessEmail").toLowerCase(), businessPhone: text(form, "businessPhone"),
    addressLine1: text(form, "addressLine1"), addressLine2: text(form, "addressLine2"),
    suburb: text(form, "suburb"), city: text(form, "city"), postcode: text(form, "postcode"),
    nzbn: text(form, "nzbn"), gstStatus: text(form, "gstStatus"), gstNumber: text(form, "gstNumber"),
    currency: text(form, "currency"), timezone: text(form, "timezone"),
    paymentTerms: Number(text(form, "paymentTerms")), expectedUpdatedAt: text(form, "expectedUpdatedAt"),
  };
  const fieldErrors: SettingsFieldErrors = {};
  if (data.legalName.length < 2 || data.legalName.length > 200) error(fieldErrors, "legalName", "Enter the legal business name.");
  if (data.tradingName.length < 2 || data.tradingName.length > 200) error(fieldErrors, "tradingName", "Enter the trading name used with customers.");
  if (!emailPattern.test(data.businessEmail)) error(fieldErrors, "businessEmail", "Enter a valid business email.");
  if (!data.addressLine1) error(fieldErrors, "addressLine1", "Enter the business street address.");
  if (!data.city) error(fieldErrors, "city", "Enter the city or town.");
  if (!/^\d{4}$/.test(data.postcode)) error(fieldErrors, "postcode", "Enter a 4-digit New Zealand postcode.");
  if (data.nzbn && !/^\d{13}$/.test(data.nzbn)) error(fieldErrors, "nzbn", "NZBN must contain 13 digits.");
  if (!['registered', 'not_registered'].includes(data.gstStatus)) error(fieldErrors, "gstStatus", "Confirm whether the business is GST registered.");
  if (data.gstStatus === "registered" && !isValidNzIrdNumber(data.gstNumber)) error(fieldErrors, "gstNumber", "Enter a valid New Zealand GST number.");
  if (data.currency !== "NZD") error(fieldErrors, "currency", "KiwiOps currently supports NZD only.");
  if (!timezonePattern.test(data.timezone)) error(fieldErrors, "timezone", "Select a valid organization timezone.");
  if (!Number.isInteger(data.paymentTerms) || data.paymentTerms < 0 || data.paymentTerms > 365) error(fieldErrors, "paymentTerms", "Enter payment terms from 0 to 365 days.");
  if (!data.expectedUpdatedAt) error(fieldErrors, "form", "Refresh this page before saving.");
  return { data: { ...data, gstRegistered: data.gstStatus === "registered", gstNumber: data.gstStatus === "registered" ? normalizeNzIrdNumber(data.gstNumber) : null }, fieldErrors };
}

export function hasSettingsErrors(errors: SettingsFieldErrors) {
  return Object.keys(errors).length > 0;
}

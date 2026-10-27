const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateOnly(value: string) {
  if (!DATE_KEY.test(value)) throw new Error("Invalid calendar date.");
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

export function organizationDateKey(value: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addCalendarDays(dateKey: string, days: number) {
  const match = DATE_KEY.exec(dateKey);
  if (!match) throw new Error("Invalid calendar date.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export function timestampToDateTimeLocal(value: string | null, timeZone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

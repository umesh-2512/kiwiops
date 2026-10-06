function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function localMidnightUtc(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let result = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = zonedParts(new Date(result), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    result += target - represented;
  }
  return new Date(result);
}

export function organizationDayBounds(dateKey: string, timeZone: string) {
  const start = localMidnightUtc(dateKey, timeZone);
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextKey = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { start: start.toISOString(), end: localMidnightUtc(nextKey, timeZone).toISOString() };
}

export function organizationGreeting(timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-NZ", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function organizationDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T00:00:00Z`));
}

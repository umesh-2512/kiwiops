import { describe, expect, it } from "vitest";
import { addCalendarDays, formatDateOnly, organizationDateKey, timestampToDateTimeLocal } from "./timezone";

describe("organization timezone utilities", () => {
  it("uses NZ standard time independently of the runtime timezone", () => {
    expect(organizationDateKey("2026-07-01T12:30:00Z", "Pacific/Auckland")).toBe("2026-07-02");
  });

  it("uses NZ daylight saving time independently of the runtime timezone", () => {
    expect(organizationDateKey("2026-01-01T10:30:00Z", "Pacific/Auckland")).toBe("2026-01-01");
    expect(organizationDateKey("2026-01-01T11:30:00Z", "Pacific/Auckland")).toBe("2026-01-02");
  });

  it("formats scheduled instants for the organization rather than the browser", () => {
    expect(timestampToDateTimeLocal("2026-06-30T20:15:00Z", "Pacific/Auckland")).toBe("2026-07-01T08:15");
    expect(timestampToDateTimeLocal("2026-01-01T00:15:00Z", "Pacific/Auckland")).toBe("2026-01-01T13:15");
  });

  it("adds calendar days without crossing through a runtime timezone", () => {
    expect(addCalendarDays("2026-09-26", 2)).toBe("2026-09-28");
    expect(addCalendarDays("2026-04-04", 2)).toBe("2026-04-06");
  });

  it("keeps date-only values on their original calendar day", () => {
    expect(formatDateOnly("2026-01-01")).toContain("1 Jan 2026");
  });
});

import { describe, expect, it } from "vitest";
import { organizationDateLabel, organizationDayBounds, organizationGreeting } from "./timezone";

describe("dashboard organization timezone", () => {
  it("creates Auckland business-day bounds during daylight saving", () => {
    expect(organizationDayBounds("2026-10-06", "Pacific/Auckland")).toEqual({ start: "2026-10-05T11:00:00.000Z", end: "2026-10-06T11:00:00.000Z" });
  });

  it("handles a daylight-saving boundary without assuming a 24-hour UTC day", () => {
    const bounds = organizationDayBounds("2026-09-27", "Pacific/Auckland");
    expect(bounds.start).toBe("2026-09-26T12:00:00.000Z");
    expect(bounds.end).toBe("2026-09-27T11:00:00.000Z");
  });

  it("uses organization-local time for the greeting", () => {
    expect(organizationGreeting("Pacific/Auckland", new Date("2026-10-05T19:00:00Z"))).toBe("Good morning");
    expect(organizationGreeting("Pacific/Auckland", new Date("2026-10-06T07:00:00Z"))).toBe("Good evening");
  });

  it("formats the supplied organization date without browser timezone drift", () => {
    expect(organizationDateLabel("2026-10-06")).toContain("6 October 2026");
  });
});

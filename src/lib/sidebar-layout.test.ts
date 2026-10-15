import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const shell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");

function rule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  const bodyStart = css.indexOf("{", start) + 1;
  return css.slice(bodyStart, css.indexOf("}", bodyStart));
}

describe("sidebar responsive-height contract", () => {
  it("uses the dynamic viewport height and retains an outer overflow fallback", () => {
    const sidebar = rule(".sidebar");
    expect(sidebar).toContain("height: 100dvh");
    expect(sidebar).toContain("max-height: 100dvh");
    expect(sidebar).toContain("overflow-y: auto");
  });

  it("allows navigation to shrink and scroll without pushing out account controls", () => {
    const navigation = rule(".primary-nav");
    expect(navigation).toContain("min-height: 0");
    expect(navigation).toContain("flex: 1 1 auto");
    expect(navigation).toContain("overflow-y: auto");
  });

  it("keeps branding, workspace, and account controls outside the shrinking region", () => {
    expect(rule(".brand-row")).toContain("flex-shrink: 0");
    expect(rule(".org-switcher")).toContain("flex-shrink: 0");
    expect(rule(".sidebar-footer")).toContain("flex-shrink: 0");
    expect(shell.indexOf('className="primary-nav"')).toBeLessThan(shell.indexOf('className="sidebar-footer"'));
    expect(shell).toContain("<SignOutButton />");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("mobile navigation accessibility contract", () => {
  it("exposes the drawer relationship and expanded state", () => {
    expect(shell).toContain('aria-controls="mobile-navigation"');
    expect(shell).toContain("aria-expanded={menuOpen}");
    expect(shell).toContain('id="mobile-navigation"');
    expect(shell).toContain('role={mobileLayout ? "dialog" : undefined}');
    expect(shell).toContain("aria-modal={mobileLayout && menuOpen ? true : undefined}");
  });

  it("moves focus into the drawer and restores it after dismissal", () => {
    expect(shell).toContain("closeButtonRef.current?.focus()");
    expect(shell).toContain("menuButtonRef.current?.focus()");
    expect(shell).toContain("restoreMenuFocusRef");
  });

  it("traps forward and backward tab navigation inside the open drawer", () => {
    expect(shell).toContain('event.key !== "Tab"');
    expect(shell).toContain("event.shiftKey");
    expect(shell).toContain("last.focus()");
    expect(shell).toContain("first.focus()");
  });

  it("closes on Escape and locks background scrolling", () => {
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain('document.body.style.overflow = "hidden"');
    expect(shell).toContain("document.body.style.overflow = previousOverflow");
  });

  it("removes the closed mobile drawer from keyboard and screen-reader navigation", () => {
    expect(shell).toContain("inert={mobileLayout && !menuOpen ? true : undefined}");
    expect(shell).toContain("aria-hidden={mobileLayout && !menuOpen ? true : undefined}");
  });

  it("closes after link navigation and moves focus to the routed content", () => {
    expect(shell).toContain("onClick={navigateFromDrawer}");
    expect(shell).toContain("mainRef.current?.focus()");
    expect(shell).toContain('tabIndex={-1}>{children}</main>');
  });

  it("retains desktop semantics and nested-route active states", () => {
    expect(shell).toContain('role={mobileLayout ? "dialog" : undefined}');
    expect(shell).toContain("if (!mobileLayout) return;");
    expect(shell).toContain('item.href !== "/" && pathname.startsWith(`${item.href}/`)');
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
  });

  it("provides mobile touch targets, narrow-screen containment, and reduced motion", () => {
    expect(css).toMatch(/\.sidebar-close, \.mobile-menu \{ width: 44px; height: 44px; \}/);
    expect(css).toMatch(/\.nav-item \{ min-height: 44px; \}/);
    expect(css).toContain("max-width: calc(100vw - 48px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

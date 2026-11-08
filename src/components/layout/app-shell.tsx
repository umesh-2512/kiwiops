"use client";

import {
  Bell,
  BriefcaseBusiness,
  FileText,
  Gauge,
  HandCoins,
  Inbox,
  Lightbulb,
  Menu,
  ReceiptText,
  Search,
  Settings,
  Users,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { navigationItems, technicianNavigationItems } from "@/lib/navigation";

const iconMap = {
  dashboard: Gauge,
  insights: Lightbulb,
  customers: Users,
  enquiries: Inbox,
  quotes: FileText,
  jobs: BriefcaseBusiness,
  invoices: ReceiptText,
  team: UsersRound,
  reports: HandCoins,
  settings: Settings,
};

type AppShellViewer = {
  initials: string;
  name: string;
  organizationName: string;
  role: "owner" | "admin" | "technician";
};

const roleLabels = {
  owner: "Business owner",
  admin: "Administrator",
  technician: "Technician",
};

export function AppShell({ children, viewer }: { children: React.ReactNode; viewer: AppShellViewer }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const restoreMenuFocusRef = useRef(false);
  const routeNavigationRef = useRef(false);
  const items = viewer.role === "technician" ? technicianNavigationItems : navigationItems;
  const homeHref = viewer.role === "technician" ? "/my-jobs" : "/";

  const closeNavigation = useCallback((restoreFocus = true) => {
    restoreMenuFocusRef.current = restoreFocus;
    setMenuOpen(false);
  }, []);

  const navigateFromDrawer = useCallback(() => {
    if (!mobileLayout) return;
    routeNavigationRef.current = true;
    closeNavigation(false);
  }, [closeNavigation, mobileLayout]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 840px)");
    const updateLayout = () => {
      setMobileLayout(media.matches);
      if (!media.matches) setMenuOpen(false);
    };
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (routeNavigationRef.current) {
      routeNavigationRef.current = false;
      requestAnimationFrame(() => mainRef.current?.focus());
    }
    const frame = requestAnimationFrame(() => setMenuOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!mobileLayout) return;
    if (!menuOpen) {
      if (restoreMenuFocusRef.current) {
        restoreMenuFocusRef.current = false;
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNavigation();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => !element.hasAttribute("inert"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sidebarRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sidebarRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeNavigation, menuOpen, mobileLayout]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside
        aria-hidden={mobileLayout && !menuOpen ? true : undefined}
        aria-label={mobileLayout ? "Primary navigation menu" : undefined}
        aria-modal={mobileLayout && menuOpen ? true : undefined}
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
        id="mobile-navigation"
        inert={mobileLayout && !menuOpen ? true : undefined}
        ref={sidebarRef}
        role={mobileLayout ? "dialog" : undefined}
      >
        <div className="brand-row">
          <Link className="brand" href={homeHref} aria-label="KiwiOps home" onClick={navigateFromDrawer}>
            <span className="brand-mark" aria-hidden="true">
              <Wrench size={17} strokeWidth={2.2} />
            </span>
            <span>KiwiOps</span>
          </Link>
          <button
            aria-label="Close navigation"
            className="icon-button sidebar-close"
            onClick={() => closeNavigation()}
            ref={closeButtonRef}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <div className="org-switcher">
          <span className="org-avatar" aria-hidden="true">{viewer.organizationName.slice(0, 2).toUpperCase()}</span>
          <span className="org-copy">
            <strong>{viewer.organizationName}</strong>
            <small>Current workspace</small>
          </span>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {items.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={navigateFromDrawer}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span className="user-avatar" aria-hidden="true">{viewer.initials}</span>
            <span className="org-copy">
              <strong>{viewer.name}</strong>
              <small>{roleLabels[viewer.role]}</small>
            </span>
          </div>
          <form action={signOutAction}><SignOutButton /></form>
          <p>KiwiOps <span>Preview</span></p>
        </div>
      </aside>

      {menuOpen ? (
        <button
          aria-label="Close navigation"
          aria-hidden="true"
          className="sidebar-scrim"
          onClick={() => closeNavigation()}
          tabIndex={-1}
          type="button"
        />
      ) : null}

      <div className="content-frame">
        <header className="topbar">
          <button
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label="Open navigation"
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            ref={menuButtonRef}
            type="button"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-brand">KiwiOps</div>
          <button className="search-trigger" type="button" disabled>
            <Search aria-hidden="true" size={17} />
            <span>Search customers, jobs, invoices...</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <span className="connection-state"><i /> Workspace ready</span>
            <button className="icon-button" aria-label="Notifications" type="button">
              <Bell size={19} />
            </button>
            <span className="topbar-avatar" aria-label={`Signed in as ${viewer.name}`}>{viewer.initials}</span>
          </div>
        </header>

        <main className="main-content" id="main-content" ref={mainRef} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

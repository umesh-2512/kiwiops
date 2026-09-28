"use client";

import {
  Bell,
  BriefcaseBusiness,
  FileText,
  Gauge,
  HandCoins,
  Inbox,
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
import { useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { navigationItems } from "@/lib/navigation";

const iconMap = {
  dashboard: Gauge,
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

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Link className="brand" href="/" aria-label="KiwiOps dashboard" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark" aria-hidden="true">
              <Wrench size={17} strokeWidth={2.2} />
            </span>
            <span>KiwiOps</span>
          </Link>
          <button
            aria-label="Close navigation"
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
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
          {navigationItems.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
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
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      <div className="content-frame">
        <header className="topbar">
          <button
            aria-expanded={menuOpen}
            aria-label="Open navigation"
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
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

        <main className="main-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}

export const navigationItems = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Customers", href: "/customers", icon: "customers" },
  { label: "Enquiries", href: "/enquiries", icon: "enquiries" },
  { label: "Quotes", href: "/quotes", icon: "quotes" },
  { label: "Jobs", href: "/jobs", icon: "jobs" },
  { label: "Invoices", href: "/invoices", icon: "invoices" },
  { label: "Team", href: "/team", icon: "team" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Settings", href: "/settings", icon: "settings" },
] as const;

export const technicianNavigationItems = [
  { label: "My Jobs", href: "/my-jobs", icon: "jobs" },
] as const;

export const modulePages: Record<string, {
  title: string;
  eyebrow: string;
  description: string;
  action: string;
}> = {
  customers: {
    title: "Customers",
    eyebrow: "Customer management",
    description: "Keep contact details, service addresses, and work history together.",
    action: "New customer",
  },
  enquiries: {
    title: "Enquiries",
    eyebrow: "Incoming work",
    description: "Review new requests and move qualified work into a quote or job.",
    action: "New enquiry",
  },
  quotes: {
    title: "Quotes",
    eyebrow: "Sales pipeline",
    description: "Prepare clear, itemised quotes and track every customer response.",
    action: "New quote",
  },
  jobs: {
    title: "Jobs",
    eyebrow: "Service delivery",
    description: "Schedule field work, assign technicians, and record completion.",
    action: "New job",
  },
  invoices: {
    title: "Invoices",
    eyebrow: "Accounts receivable",
    description: "Issue GST-ready invoices and keep payment status visible.",
    action: "New invoice",
  },
  team: {
    title: "Team",
    eyebrow: "People and access",
    description: "Manage staff, field technicians, and role-based permissions.",
    action: "Invite member",
  },
  reports: {
    title: "Reports",
    eyebrow: "Business performance",
    description: "Understand revenue, completed work, and operational load.",
    action: "Create report",
  },
  settings: {
    title: "Settings",
    eyebrow: "Business configuration",
    description: "Configure your organisation, tax rules, numbering, and preferences.",
    action: "Save settings",
  },
};

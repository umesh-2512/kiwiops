import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  ReceiptText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getViewerContext } from "@/lib/auth/context";

const modules = [
  { title: "Customers", description: "Customer records, contact details, and service history.", href: "/customers", icon: Users },
  { title: "Quotes", description: "Itemised estimates with clear status tracking.", href: "/quotes", icon: FileText },
  { title: "Jobs", description: "Scheduling, assignment, notes, and completion.", href: "/jobs", icon: CalendarDays },
  { title: "Invoices", description: "GST-ready billing and payment records.", href: "/invoices", icon: ReceiptText },
];

export default async function DashboardPage() {
  const viewer = await getViewerContext();

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Your operations workspace</p>
          <h1>Good to see you, {viewer?.firstName}</h1>
          <p className="page-description">{viewer?.organization?.name} is ready for day-to-day operations.</p>
        </div>
        <button className="button button-primary" type="button" disabled><span aria-hidden="true">+</span>Create job</button>
      </section>

      <section className="foundation-card" aria-labelledby="foundation-title">
        <div className="foundation-copy">
          <span className="status-pill status-pill-success"><CheckCircle2 aria-hidden="true" size={14} />Workspace secured</span>
          <h2 id="foundation-title">Your business workspace is connected.</h2>
          <p>Authentication, organization ownership, role-based access, and customer management are active.</p>
        </div>
        <div className="workflow" aria-label="Planned service workflow">
          {["Enquiry", "Quote", "Job", "Invoice", "Paid"].map((step, index) => (
            <div className="workflow-step" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>
              {index < 4 ? <ArrowRight aria-hidden="true" size={16} /> : null}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="workspace-title">
        <div className="section-heading">
          <div><p className="eyebrow">Workspace</p><h2 id="workspace-title">Core operations</h2></div>
          <span className="section-note">Customer management is ready</span>
        </div>
        <div className="module-grid">
          {modules.map(({ title, description, href, icon: Icon }) => (
            <Link className="module-card" href={href} key={title}>
              <span className="module-icon"><Icon aria-hidden="true" size={20} strokeWidth={1.8} /></span>
              <span className="module-copy"><strong>{title}</strong><span>{description}</span></span>
              <ArrowRight aria-hidden="true" className="module-arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>

      <section className="empty-dashboard" aria-labelledby="overview-title">
        <div className="empty-dashboard-copy">
          <span className="empty-mark" aria-hidden="true">KO</span>
          <div><p className="eyebrow">Today&apos;s overview</p><h2 id="overview-title">Your live dashboard starts here.</h2><p>Jobs, invoices, quote follow-ups, and service reminders will appear here when operational workflows are added.</p></div>
        </div>
        <span className="status-pill">No demo metrics</span>
      </section>
    </div>
  );
}

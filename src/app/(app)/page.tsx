import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  FileText,
  Plus,
  ReceiptText,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/quotes/money";
import { jobStatusLabels } from "@/lib/jobs/types";
import { activityHref, assignedTechnicians, attentionItems } from "@/lib/dashboard/presentation";
import { getOperationalDashboard, requireDashboardOfficeContext } from "@/lib/dashboard/data";
import { organizationDateLabel, organizationGreeting } from "@/lib/dashboard/timezone";
import type { DashboardData, DashboardJob } from "@/lib/dashboard/types";

const workflow = ["Enquiry", "Quote", "Job", "Invoice", "Paid"];

function customerName(job: DashboardJob) {
  return `${job.customers.first_name} ${job.customers.last_name}`.trim();
}

function timeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

function dateTimeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-NZ", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

function JobRow({ job, timeZone, upcoming = false }: { job: DashboardJob; timeZone: string; upcoming?: boolean }) {
  const technicians = assignedTechnicians(job);
  return (
    <Link className="dashboard-job" href={`/jobs/${job.id}`}>
      <time dateTime={job.scheduled_start_at}>{upcoming ? dateTimeLabel(job.scheduled_start_at, timeZone) : timeLabel(job.scheduled_start_at, timeZone)}</time>
      <span className="dashboard-job-main"><strong>{job.job_type}</strong><span>{job.job_number} · {customerName(job)}</span></span>
      <span className="dashboard-job-team">{technicians.length ? technicians.join(", ") : "Unassigned"}</span>
      <span className={`record-status job-status-${job.status}`}>{jobStatusLabels[job.status]}</span>
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

export default async function DashboardPage() {
  const { organization, viewer } = await requireDashboardOfficeContext();
  let data: DashboardData;
  try {
    data = await getOperationalDashboard(organization.id);
  } catch {
    return (
      <section className="route-error" role="alert">
        <span className="empty-mark"><AlertCircle aria-hidden="true" size={20} /></span>
        <p className="eyebrow">Dashboard unavailable</p>
        <h1>We couldn&apos;t load your operational overview.</h1>
        <p>No figures have been replaced with placeholder values. Refresh after checking the database connection.</p>
      </section>
    );
  }

  const { summary } = data;
  const attention = attentionItems(summary);
  const attentionCopy: Record<string, { title: string; detail: string }> = {
    overdue: { title: `${summary.overdue_invoice_count} overdue ${summary.overdue_invoice_count === 1 ? "invoice" : "invoices"}`, detail: `${formatMoney(summary.overdue_cents, summary.currency)} remains collectible` },
    enquiries: { title: `${summary.urgent_open_enquiries} high-priority ${summary.urgent_open_enquiries === 1 ? "enquiry" : "enquiries"}`, detail: "Open enquiries marked high or urgent" },
    unscheduled: { title: `${summary.unscheduled_jobs} unscheduled ${summary.unscheduled_jobs === 1 ? "job" : "jobs"}`, detail: "Work waiting for a scheduled start" },
    unassigned: { title: `${summary.unassigned_scheduled_jobs} scheduled ${summary.unassigned_scheduled_jobs === 1 ? "job has" : "jobs have"} no technician`, detail: "Assign an active technician before work begins" },
    quotes: { title: `${summary.quotes_awaiting_decision} ${summary.quotes_awaiting_decision === 1 ? "quote is" : "quotes are"} awaiting a decision`, detail: "Issued quotes without an accepted or declined outcome" },
  };

  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Operational dashboard</p>
          <h1>{organizationGreeting(summary.timezone)}, {viewer.firstName}</h1>
          <p className="page-description">Here&apos;s what&apos;s happening across {organization.name} today.</p>
          <p className="dashboard-date"><CalendarDays aria-hidden="true" size={14} />{organizationDateLabel(summary.organization_today)}</p>
        </div>
        <nav className="dashboard-actions" aria-label="Quick actions">
          <Link className="button button-secondary" href="/customers/new"><UserPlus aria-hidden="true" size={15} />Customer</Link>
          <Link className="button button-secondary" href="/enquiries/new"><Plus aria-hidden="true" size={15} />Enquiry</Link>
          <Link className="button button-secondary" href="/quotes/new"><FilePlus2 aria-hidden="true" size={15} />Quote</Link>
          <Link className="button button-primary" href="/jobs/new"><BriefcaseBusiness aria-hidden="true" size={15} />Job</Link>
        </nav>
      </section>

      <section className="dashboard-kpis" aria-label="Business summary">
        <Link className="dashboard-kpi" href="/enquiries"><span>Open enquiries</span><strong>{summary.open_enquiries}</strong><small>New or under review</small></Link>
        <Link className="dashboard-kpi" href="/jobs"><span>Active jobs</span><strong>{summary.active_jobs}</strong><small>Unscheduled, scheduled or in progress</small></Link>
        <Link className="dashboard-kpi dashboard-kpi-money" href="/invoices"><span>Outstanding invoices</span><strong>{formatMoney(summary.outstanding_cents, summary.currency)}</strong><small>{summary.outstanding_invoice_count} collectible {summary.outstanding_invoice_count === 1 ? "invoice" : "invoices"}</small></Link>
        <Link className="dashboard-kpi" href="/quotes?status=sent"><span>Quotes awaiting decision</span><strong>{summary.quotes_awaiting_decision}</strong><small>Issued without an outcome</small></Link>
      </section>

      <div className="dashboard-primary-grid">
        <section className="dashboard-panel dashboard-attention" aria-labelledby="attention-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Priority</p><h2 id="attention-title">Attention required</h2></div><AlertCircle aria-hidden="true" size={20} /></div>
          {attention.length ? <div className="attention-list">{attention.map((item) => <Link href={item.href} key={item.key}><span className="attention-indicator" /><span><strong>{attentionCopy[item.key].title}</strong><small>{attentionCopy[item.key].detail}</small></span><ArrowRight aria-hidden="true" size={16} /></Link>)}</div> : <div className="dashboard-empty"><strong>Nothing needs immediate attention.</strong><span>Your open work has no current exceptions.</span></div>}
        </section>

        <section className="dashboard-panel dashboard-today" aria-labelledby="today-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Schedule</p><h2 id="today-title">Today&apos;s jobs</h2></div><Link href="/jobs?status=scheduled">View jobs <ArrowRight aria-hidden="true" size={14} /></Link></div>
          {data.todayJobs.length ? <div className="dashboard-job-list">{data.todayJobs.map((job) => <JobRow job={job} key={job.id} timeZone={summary.timezone} />)}</div> : <div className="dashboard-empty"><strong>No jobs scheduled for today.</strong><span>Your scheduled jobs will appear here.</span></div>}
        </section>
      </div>

      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel" aria-labelledby="financial-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Cash position</p><h2 id="financial-title">Financial overview</h2></div><CircleDollarSign aria-hidden="true" size={20} /></div>
          <dl className="dashboard-financial">
            <div><dt>Outstanding</dt><dd>{formatMoney(summary.outstanding_cents, summary.currency)}</dd><small>{summary.outstanding_invoice_count} issued {summary.outstanding_invoice_count === 1 ? "invoice" : "invoices"}</small></div>
            <div><dt>Overdue</dt><dd>{formatMoney(summary.overdue_cents, summary.currency)}</dd><small>{summary.overdue_invoice_count} past {summary.overdue_invoice_count === 1 ? "its" : "their"} due date</small></div>
            <div><dt>Paid this month</dt><dd>{formatMoney(summary.paid_this_month_cents, summary.currency)}</dd><small>Active payments received</small></div>
          </dl>
          <Link className="dashboard-panel-link" href="/invoices">Open invoices <ArrowRight aria-hidden="true" size={14} /></Link>
        </section>

        <section className="dashboard-panel" aria-labelledby="pipeline-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Work pipeline</p><h2 id="pipeline-title">Enquiries and quotes</h2></div><FileText aria-hidden="true" size={20} /></div>
          <div className="dashboard-pipeline">
            <div><span>Enquiries</span><dl><div><dt>New</dt><dd>{summary.enquiry_new}</dd></div><div><dt>Reviewing</dt><dd>{summary.enquiry_reviewing}</dd></div></dl></div>
            <div><span>Quotes</span><dl><div><dt>Draft</dt><dd>{summary.quote_draft}</dd></div><div><dt>Awaiting decision</dt><dd>{summary.quote_sent}</dd></div><div><dt>Accepted</dt><dd>{summary.quote_accepted}</dd></div></dl></div>
          </div>
          <div className="dashboard-panel-links"><Link href="/enquiries">View enquiries</Link><Link href="/quotes">View quotes</Link></div>
        </section>
      </div>

      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel" aria-labelledby="activity-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Latest updates</p><h2 id="activity-title">Recent activity</h2></div><Clock3 aria-hidden="true" size={20} /></div>
          {data.activity.length ? <ol className="dashboard-activity">{data.activity.map((activity) => { const href = activityHref(activity); const content = <><span className="activity-dot" /><span><strong>{activity.summary}</strong><small>{activity.actor_name ?? "KiwiOps"} · <time dateTime={activity.created_at}>{dateTimeLabel(activity.created_at, summary.timezone)}</time></small></span>{href ? <ArrowRight aria-hidden="true" size={14} /> : null}</>; return <li key={activity.id}>{href ? <Link href={href}>{content}</Link> : <div>{content}</div>}</li>; })}</ol> : <div className="dashboard-empty"><strong>No recent activity yet.</strong><span>Meaningful workflow events will appear here.</span></div>}
        </section>

        <section className="dashboard-panel" aria-labelledby="upcoming-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Next in line</p><h2 id="upcoming-title">Upcoming jobs</h2></div><BriefcaseBusiness aria-hidden="true" size={20} /></div>
          {data.upcomingJobs.length ? <div className="dashboard-job-list dashboard-upcoming-list">{data.upcomingJobs.map((job) => <JobRow job={job} key={job.id} timeZone={summary.timezone} upcoming />)}</div> : <div className="dashboard-empty"><strong>No upcoming jobs scheduled.</strong><span>Future scheduled work will appear here.</span></div>}
        </section>
      </div>

      <section className="foundation-card dashboard-workflow" aria-labelledby="workflow-title">
        <div className="foundation-copy"><span className="status-pill status-pill-success"><ReceiptText aria-hidden="true" size={14} />One connected workspace</span><h2 id="workflow-title">Your operations, connected.</h2><p>From the first customer enquiry through to final payment, every step stays linked.</p></div>
        <div className="workflow" aria-label="KiwiOps service workflow">{workflow.map((step, index) => <div className="workflow-step" key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < workflow.length - 1 ? <ArrowRight aria-hidden="true" size={16} /> : null}</div>)}</div>
      </section>
    </div>
  );
}

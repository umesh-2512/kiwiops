import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, FileText, Mail, MapPin, Pencil, Phone, ReceiptText } from "lucide-react";
import Link from "next/link";
import { CustomerStatusAction } from "@/components/customers/customer-status-action";
import { getCustomer, getCustomerActivity, requireOfficeContext } from "@/lib/customers/data";
import { customerDisplayName } from "@/lib/customers/types";
import { getRecentCustomerQuotes } from "@/lib/quotes/data";
import { formatMoney } from "@/lib/quotes/money";
import { quoteStatusLabels, type QuoteStatus } from "@/lib/quotes/types";
import { getRecentCustomerJobs } from "@/lib/jobs/data";
import { jobStatusLabels, type JobStatus } from "@/lib/jobs/types";

type CustomerPageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
};

const notices: Record<string, string> = {
  archived: "Customer archived.",
  created: "Customer created.",
  restored: "Customer restored.",
  updated: "Customer details updated.",
};

export async function generateMetadata({ params }: CustomerPageProps): Promise<Metadata> {
  const { customerId } = await params;
  const { organization } = await requireOfficeContext();
  const customer = await getCustomer(customerId, organization.id);
  return { title: customerDisplayName(customer) };
}

export default async function CustomerPage({ params, searchParams }: CustomerPageProps) {
  const { customerId } = await params;
  const { organization } = await requireOfficeContext();
  const [customer, activity, quotes, jobs] = await Promise.all([
    getCustomer(customerId, organization.id),
    getCustomerActivity(customerId, organization.id),
    getRecentCustomerQuotes(customerId, organization.id),
    getRecentCustomerJobs(customerId, organization.id),
  ]);
  const name = customerDisplayName(customer);
  const rawNotice = (await searchParams).notice;
  const notice = notices[Array.isArray(rawNotice) ? rawNotice[0] : rawNotice ?? ""];
  const address = [
    { field: "address-line-1", value: customer.address_line_1 },
    { field: "address-line-2", value: customer.address_line_2 },
    { field: "suburb", value: customer.suburb },
    { field: "city", value: customer.city },
    { field: "postcode", value: customer.postcode },
  ].filter(({ value }) => Boolean(value));

  return (
    <div className="page-stack">
      <Link className="back-link" href={`/customers${customer.status === "archived" ? "?status=archived" : ""}`}><ChevronLeft aria-hidden="true" size={16} />Customers</Link>
      {notice ? <p aria-live="polite" className="success-banner">{notice}</p> : null}
      <section className="customer-detail-heading">
        <div className="customer-title-block"><span className="customer-avatar customer-avatar-large" aria-hidden="true">{customer.first_name[0]}{customer.last_name[0]}</span><div><p className="eyebrow">Customer record</p><h1>{name}</h1><span className={`record-status record-status-${customer.status}`}>{customer.status}</span></div></div>
        <div className="detail-actions"><Link className="button button-secondary" href={`/customers/${customer.id}/edit`}><Pencil aria-hidden="true" size={16} />Edit</Link><CustomerStatusAction archived={customer.status === "archived"} customerId={customer.id} customerName={name} /></div>
      </section>

      <div className="customer-detail-grid">
        <div className="detail-main">
          <section className="detail-card" aria-labelledby="contact-title"><div className="detail-card-heading"><p className="eyebrow">Contact</p><h2 id="contact-title">Customer details</h2></div><dl className="detail-list">
            <div><dt><Mail aria-hidden="true" size={16} />Email</dt><dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : <span className="muted-value">Not provided</span>}</dd></div>
            <div><dt><Phone aria-hidden="true" size={16} />Phone</dt><dd>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : <span className="muted-value">Not provided</span>}</dd></div>
            <div><dt><MapPin aria-hidden="true" size={16} />Service address</dt><dd>{address.length ? address.map(({ field, value }) => <span key={field}>{value}</span>) : <span className="muted-value">Not provided</span>}</dd></div>
          </dl></section>

          <section className="detail-card" aria-labelledby="notes-title"><div className="detail-card-heading"><p className="eyebrow">Internal notes</p><h2 id="notes-title">Customer context</h2></div><p className={customer.notes ? "customer-notes" : "muted-value"}>{customer.notes || "No notes have been added."}</p></section>

          <section className="detail-card" aria-labelledby="future-work-title"><div className="detail-card-heading"><p className="eyebrow">Related work</p><h2 id="future-work-title">Business records</h2></div>{jobs.length || quotes.length ? <div className="related-record-list">{jobs.map(job => <Link href={`/jobs/${job.id}`} key={job.id}><span><strong>{job.job_number}</strong><small>{job.job_type} · {jobStatusLabels[job.status as JobStatus]}</small></span></Link>)}{quotes.map(quote => <Link href={`/quotes/${quote.id}`} key={quote.id}><span><strong>{quote.quote_number}</strong><small>{quoteStatusLabels[quote.status as QuoteStatus]}</small></span><b>{formatMoney(quote.total_cents, quote.currency)}</b></Link>)}</div> : <div className="future-records">
            <div><CalendarDays aria-hidden="true" size={18} /><span><strong>Jobs</strong><small>No jobs yet</small></span></div>
            <div><FileText aria-hidden="true" size={18} /><span><strong>Quotes</strong><small>No quotes yet</small></span></div>
            <div><ReceiptText aria-hidden="true" size={18} /><span><strong>Invoices</strong><small>Available in a future milestone</small></span></div>
          </div>}</section>
        </div>

        <aside className="detail-side">
          <section className="detail-card" aria-labelledby="activity-title"><div className="detail-card-heading"><p className="eyebrow">History</p><h2 id="activity-title">Activity</h2></div>{activity.length ? <ol className="activity-list">{activity.map((item) => <li key={item.id}><i aria-hidden="true" /><div><strong>{item.summary}</strong><time dateTime={item.created_at}>{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time></div></li>)}</ol> : <p className="muted-value">No customer activity has been recorded yet.</p>}</section>
          <section className="detail-card record-meta" aria-labelledby="record-title"><div className="detail-card-heading"><p className="eyebrow">Record</p><h2 id="record-title">Details</h2></div><dl><div><dt>Created</dt><dd><time dateTime={customer.created_at}>{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(customer.created_at))}</time></dd></div><div><dt>Last updated</dt><dd><time dateTime={customer.updated_at}>{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(customer.updated_at))}</time></dd></div></dl></section>
        </aside>
      </div>
    </div>
  );
}

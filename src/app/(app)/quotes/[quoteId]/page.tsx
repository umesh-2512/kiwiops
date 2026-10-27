import type { Metadata } from "next";
import { ChevronLeft, Pencil, UserRound } from "lucide-react";
import Link from "next/link";
import { QuoteStatusActions } from "@/components/quotes/quote-status-actions";
import {
  getQuote,
  getQuoteActivity,
  getQuoteDefaults,
  getQuoteDocumentBusiness,
  requireQuoteOfficeContext,
} from "@/lib/quotes/data";
import { formatMoney } from "@/lib/quotes/money";
import { isQuoteExpired, quoteDocumentParties } from "@/lib/quotes/presentation";
import { quoteStatusLabels } from "@/lib/quotes/types";
import { formatDateOnly, formatDateTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Quote details" };

const formatDate = formatDateOnly;

const joined = (values: Array<string | null | undefined>) =>
  values.filter(Boolean).join(", ");

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { quoteId } = await params;
  const { organization } = await requireQuoteOfficeContext();
  const [quote, activity, defaults] = await Promise.all([
    getQuote(quoteId, organization.id),
    getQuoteActivity(quoteId, organization.id),
    getQuoteDefaults(organization.id),
  ]);
  const liveBusiness =
    quote.status === "draft"
      ? await getQuoteDocumentBusiness(organization.id)
      : null;
  const parties = quoteDocumentParties(quote, liveBusiness);
  const raw = (await searchParams).notice;
  const key = Array.isArray(raw) ? raw[0] : raw;
  const notices: Record<string, string> = {
    created: "Quote draft created.",
    updated: "Quote draft saved.",
    issued: "Quote issued and locked.",
    accepted: "Quote marked accepted.",
    rejected: "Quote marked declined.",
  };
  const expired = isQuoteExpired(quote.status, quote.expiry_date, defaults.organization_today);
  const businessAddress = joined(parties.business.address);
  const businessContact = joined([parties.business.email, parties.business.phone]);
  const customerAddress = joined(parties.customer.address);
  const customerContact = joined([parties.customer.email, parties.customer.phone]);

  return (
    <div className="page-stack">
      <Link className="back-link" href="/quotes">
        <ChevronLeft size={16} />Quotes
      </Link>
      {key && notices[key] ? (
        <p aria-live="polite" className="success-banner">{notices[key]}</p>
      ) : null}
      <section className="customer-detail-heading">
        <div>
          <p className="eyebrow">Quote</p>
          <h1>{quote.quote_number}</h1>
          <div className="badge-row">
            <span className={`record-status quote-status-${quote.status}`}>
              {expired ? "Expired" : quoteStatusLabels[quote.status]}
            </span>
            <span>{parties.customer.name}</span>
          </div>
        </div>
        <div className="detail-actions">
          {quote.status === "draft" ? (
            <Link className="button button-secondary" href={`/quotes/${quote.id}/edit`}>
              <Pencil size={16} />Edit draft
            </Link>
          ) : null}
          <QuoteStatusActions id={quote.id} number={quote.quote_number} status={quote.status} />
        </div>
      </section>
      <div className="quote-detail-layout">
        <article className="quote-document">
          <header className="invoice-document-brand">
            <div>
              <p className="eyebrow">From</p>
              <h2>{parties.business.name}</h2>
              {businessAddress ? <p>{businessAddress}</p> : null}
              {businessContact ? <p>{businessContact}</p> : null}
              {parties.business.gstRegistered ? (
                <p>GST number: {parties.business.gstNumber || "Not recorded"}</p>
              ) : null}
            </div>
            <div className="invoice-document-title">
              <strong>QUOTE</strong>
              <span>{quote.quote_number}</span>
            </div>
          </header>
          <header className="quote-document-header">
            <div>
              <p className="eyebrow">Prepared for</p>
              <h2>{parties.customer.name}</h2>
              <p>{customerAddress || "No address recorded"}</p>
              {customerContact ? <p>{customerContact}</p> : null}
            </div>
            <dl>
              <div><dt>Quote number</dt><dd>{quote.quote_number}</dd></div>
              <div><dt>Issue date</dt><dd>{formatDate(quote.issue_date)}</dd></div>
              <div><dt>Valid until</dt><dd>{formatDate(quote.expiry_date)}</dd></div>
            </dl>
          </header>
          {quote.enquiries ? (
            <div className="quote-reference">
              <span>Related enquiry</span>
              <Link href={`/enquiries/${quote.enquiries.id}`}>
                {quote.enquiries.category || quote.enquiries.description.slice(0, 90)}
              </Link>
            </div>
          ) : null}
          <div className="quote-items-table">
            <div className="quote-items-head">
              <span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span>
            </div>
            {quote.quote_items?.map((item) => (
              <div className="quote-item-row" key={item.id}>
                <strong>{item.description}</strong>
                <span data-label="Quantity">{Number(item.quantity).toLocaleString("en-NZ", { maximumFractionDigits: 3 })}</span>
                <span data-label="Unit price">{formatMoney(item.unit_price_cents, quote.currency)}</span>
                <span data-label="Line total">{formatMoney(item.line_total_cents, quote.currency)}</span>
              </div>
            ))}
          </div>
          <dl className="quote-totals quote-document-totals">
            <div><dt>Subtotal</dt><dd>{formatMoney(quote.subtotal_cents, quote.currency)}</dd></div>
            <div><dt>GST</dt><dd>{formatMoney(quote.tax_cents, quote.currency)}</dd></div>
            <div><dt>Total</dt><dd>{formatMoney(quote.total_cents, quote.currency)}</dd></div>
          </dl>
          {quote.notes ? <section className="quote-copy"><h3>Notes</h3><p>{quote.notes}</p></section> : null}
          {quote.terms ? <section className="quote-copy"><h3>Terms</h3><p>{quote.terms}</p></section> : null}
        </article>
        <aside className="detail-side">
          <section className="detail-card">
            <div className="detail-card-heading">
              <p className="eyebrow">Customer</p>
              <h2>{parties.customer.name}</h2>
            </div>
            <Link className="button button-secondary quote-side-link" href={`/customers/${quote.customer_id}`}>
              <UserRound size={16} />View customer
            </Link>
          </section>
          <section className="detail-card">
            <div className="detail-card-heading"><p className="eyebrow">History</p><h2>Activity</h2></div>
            {activity.length ? (
              <ol className="activity-list">
                {activity.map((entry) => (
                  <li key={entry.id}><i /><div><strong>{entry.summary}</strong><time dateTime={entry.created_at}>{formatDateTime(entry.created_at, defaults.timezone)}</time></div></li>
                ))}
              </ol>
            ) : <p className="muted-value">No activity recorded.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

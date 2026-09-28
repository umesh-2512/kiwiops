import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateQuoteAction } from "@/app/actions/quotes";
import { QuoteForm } from "@/components/quotes/quote-form";
import { getQuote, getQuoteDefaults, getQuoteEnquiries, requireQuoteOfficeContext, searchQuoteCustomers } from "@/lib/quotes/data";
export const metadata: Metadata = { title: "Edit quote" };
export default async function EditQuotePage({ params }: { params: Promise<{ quoteId: string }> }) { const { quoteId } = await params; const { organization } = await requireQuoteOfficeContext(); const quote = await getQuote(quoteId, organization.id); if (quote.status !== "draft") notFound(); const [customers, enquiries, defaults] = await Promise.all([searchQuoteCustomers(organization.id, quote.customers.first_name), getQuoteEnquiries(organization.id, quote.customer_id), getQuoteDefaults(organization.id)]); return <div className="page-stack customer-form-page quote-form-page"><Link className="back-link" href={`/quotes/${quote.id}`}><ChevronLeft size={16} />{quote.quote_number}</Link><section className="page-heading"><div><p className="eyebrow">Draft quote</p><h1>Edit {quote.quote_number}</h1><p className="page-description">Saving replaces the draft line set atomically and recalculates every total.</p></div></section><QuoteForm action={updateQuoteAction.bind(null, quote.id, quote.updated_at)} currency={quote.currency} enquiries={enquiries} expiryDate={quote.expiry_date} quote={quote} customers={customers} taxRate={quote.quote_items?.[0] ? Number(quote.quote_items[0].tax_rate) : (defaults.gst_registered ? Number(defaults.default_gst_rate) : 0)} /></div>; }

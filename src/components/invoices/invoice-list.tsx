import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { InvoiceListRow } from "@/lib/invoices/types";
import { formatMoney } from "@/lib/quotes/money";
import { formatDateOnly } from "@/lib/timezone";

const stateLabels: Record<InvoiceListRow["payment_state"], string> = {
  draft: "Not issued",
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export function InvoiceList({ invoices }: { invoices: InvoiceListRow[] }) {
  return <>
    <div className="customer-table-wrap">
      <table className="customer-table">
        <thead><tr><th>Invoice</th><th>Customer</th><th>State</th><th>Total</th><th>Balance</th><th>Due</th><th /></tr></thead>
        <tbody>{invoices.map((invoice) => <tr key={invoice.id}>
          <td><Link className="enquiry-title" href={`/invoices/${invoice.id}`}><strong>{invoice.invoice_number}</strong><span>{invoice.job_number ?? "Invoice"}</span></Link></td>
          <td>{invoice.customer_name}</td>
          <td><span className={`record-status invoice-state-${invoice.payment_state}`}>{stateLabels[invoice.payment_state]}</span></td>
          <td className="money-value">{formatMoney(invoice.total_cents, invoice.currency)}</td>
          <td className="money-value">{formatMoney(invoice.balance_cents, invoice.currency)}</td>
          <td>{formatDateOnly(invoice.due_date)}</td>
          <td><Link aria-label={`Open ${invoice.invoice_number}`} className="row-link" href={`/invoices/${invoice.id}`}><ArrowRight size={17} /></Link></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="customer-mobile-list">{invoices.map((invoice) => <Link className="customer-mobile-card" href={`/invoices/${invoice.id}`} key={invoice.id}>
      <div className="customer-card-heading"><div><strong>{invoice.invoice_number}</strong><span>{invoice.customer_name}</span></div><ArrowRight size={17} /></div>
      <div className="quote-card-total">{formatMoney(invoice.total_cents, invoice.currency)}</div>
      <div className="enquiry-card-meta"><span className={`record-status invoice-state-${invoice.payment_state}`}>{stateLabels[invoice.payment_state]}</span><span>Balance {formatMoney(invoice.balance_cents, invoice.currency)}</span></div>
    </Link>)}</div>
  </>;
}

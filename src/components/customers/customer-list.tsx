import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { customerDisplayName, customerLocation, type Customer } from "@/lib/customers/types";

function CustomerContact({ customer }: { customer: Customer }) {
  return (
    <div className="customer-contact-lines">
      {customer.email ? <span><Mail aria-hidden="true" size={13} />{customer.email}</span> : null}
      {customer.phone ? <span><Phone aria-hidden="true" size={13} />{customer.phone}</span> : null}
      {!customer.email && !customer.phone ? <span className="muted-value">No contact details</span> : null}
    </div>
  );
}

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <>
      <div className="customer-table-wrap">
        <table className="customer-table">
          <thead><tr><th scope="col">Customer</th><th scope="col">Contact</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Updated</th><th aria-label="Open customer" /></tr></thead>
          <tbody>{customers.map((customer) => {
            const name = customerDisplayName(customer);
            return <tr key={customer.id}>
              <td><Link className="customer-name" href={`/customers/${customer.id}`}><span className="customer-avatar" aria-hidden="true">{customer.first_name[0]}{customer.last_name[0]}</span><strong>{name}</strong></Link></td>
              <td><CustomerContact customer={customer} /></td>
              <td>{customerLocation(customer) || <span className="muted-value">Not provided</span>}</td>
              <td><span className={`record-status record-status-${customer.status}`}>{customer.status}</span></td>
              <td><time dateTime={customer.updated_at}>{new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(customer.updated_at))}</time></td>
              <td><Link aria-label={`Open ${name}`} className="row-link" href={`/customers/${customer.id}`}><ArrowRight aria-hidden="true" size={17} /></Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="customer-mobile-list">{customers.map((customer) => {
        const name = customerDisplayName(customer);
        return <Link className="customer-mobile-card" href={`/customers/${customer.id}`} key={customer.id}>
          <div className="customer-card-heading"><span className="customer-avatar" aria-hidden="true">{customer.first_name[0]}{customer.last_name[0]}</span><div><strong>{name}</strong><span className={`record-status record-status-${customer.status}`}>{customer.status}</span></div><ArrowRight aria-hidden="true" size={17} /></div>
          <div className="customer-card-details"><CustomerContact customer={customer} /><span><MapPin aria-hidden="true" size={13} />{customerLocation(customer) || "No location provided"}</span></div>
        </Link>;
      })}</div>
    </>
  );
}

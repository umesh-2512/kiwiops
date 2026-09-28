import type { Metadata } from "next";
import { Archive, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerList } from "@/components/customers/customer-list";
import { listCustomers, requireOfficeContext } from "@/lib/customers/data";
import { CUSTOMER_PAGE_SIZE, customerListHref, parseCustomerListParams } from "@/lib/customers/query";

export const metadata: Metadata = { title: "Customers" };

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = parseCustomerListParams(await searchParams);
  const { organization } = await requireOfficeContext();
  const { count, customers } = await listCustomers({ organizationId: organization.id, ...params });
  const pageCount = Math.max(1, Math.ceil(count / CUSTOMER_PAGE_SIZE));
  if (params.page > pageCount && count > 0) redirect(customerListHref({ ...params, page: pageCount }));

  const hasFilter = Boolean(params.query);
  const isArchived = params.status === "archived";

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><p className="eyebrow">Customer management</p><h1>Customers</h1><p className="page-description">Keep customer contact details and service locations ready for office work.</p></div>
        <Link className="button button-primary" href="/customers/new"><Plus aria-hidden="true" size={16} />Add customer</Link>
      </section>

      <section className="customer-directory" aria-labelledby="customer-directory-title">
        <div className="directory-toolbar">
          <div className="status-tabs" aria-label="Customer status">
            <Link aria-current={!isArchived ? "page" : undefined} className={!isArchived ? "status-tab-active" : ""} href={customerListHref({ query: params.query, status: "active" })}>Active</Link>
            <Link aria-current={isArchived ? "page" : undefined} className={isArchived ? "status-tab-active" : ""} href={customerListHref({ query: params.query, status: "archived" })}>Archived</Link>
          </div>
          <form action="/customers" className="customer-search" role="search">
            <Search aria-hidden="true" size={17} />
            <label className="sr-only" htmlFor="customer-search">Search customers</label>
            <input defaultValue={params.query} id="customer-search" name="q" placeholder="Search name, email, phone or location" type="search" />
            {isArchived ? <input name="status" type="hidden" value="archived" /> : null}
            <button className="button button-secondary" type="submit">Search</button>
          </form>
        </div>

        <div className="directory-summary">
          <div><p className="eyebrow">{isArchived ? "Archive" : "Directory"}</p><h2 id="customer-directory-title">{isArchived ? "Archived customers" : "Active customers"}</h2></div>
          {count > 0 ? <span>{count} {count === 1 ? "customer" : "customers"}</span> : null}
        </div>

        {customers.length ? <CustomerList customers={customers} /> : (
          <div className="customer-empty">
            <span className="empty-mark" aria-hidden="true">{isArchived ? <Archive size={21} /> : <Users size={21} />}</span>
            <h2>{hasFilter ? "No customers found" : isArchived ? "No archived customers" : "No customers yet"}</h2>
            <p>{hasFilter
              ? "Try a different name, email, phone number or location."
              : isArchived
                ? "Customers you archive will remain available here."
                : "Add your first customer to start managing enquiries, jobs and invoices."}</p>
            {hasFilter ? <Link className="button button-secondary" href={customerListHref({ status: params.status })}>Clear search</Link> : !isArchived ? <Link className="button button-primary" href="/customers/new"><Plus aria-hidden="true" size={16} />Add customer</Link> : null}
          </div>
        )}

        {count > CUSTOMER_PAGE_SIZE ? (
          <nav aria-label="Customer pages" className="pagination">
            {params.page > 1 ? <Link className="button button-secondary" href={customerListHref({ ...params, page: params.page - 1 })}>Previous</Link> : <span />}
            <span>Page {params.page} of {pageCount}</span>
            {params.page < pageCount ? <Link className="button button-secondary" href={customerListHref({ ...params, page: params.page + 1 })}>Next</Link> : <span />}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

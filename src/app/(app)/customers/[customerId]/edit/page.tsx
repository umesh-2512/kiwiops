import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { updateCustomerAction } from "@/app/actions/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomer, requireOfficeContext } from "@/lib/customers/data";
import { customerDisplayName } from "@/lib/customers/types";

type EditCustomerPageProps = { params: Promise<{ customerId: string }> };

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { customerId } = await params;
  const { organization } = await requireOfficeContext();
  const customer = await getCustomer(customerId, organization.id);
  const action = updateCustomerAction.bind(null, customer.id);

  return (
    <div className="page-stack customer-form-page">
      <Link className="back-link" href={`/customers/${customer.id}`}><ChevronLeft aria-hidden="true" size={16} />{customerDisplayName(customer)}</Link>
      <section className="page-heading"><div><p className="eyebrow">Customer record</p><h1>Edit customer</h1><p className="page-description">Update contact details, service location, and internal notes.</p></div></section>
      <CustomerForm action={action} customer={customer} submitLabel="Save changes" />
    </div>
  );
}

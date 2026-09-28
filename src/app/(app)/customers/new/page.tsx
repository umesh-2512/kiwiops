import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { createCustomerAction } from "@/app/actions/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { requireOfficeContext } from "@/lib/customers/data";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requireOfficeContext();
  return (
    <div className="page-stack customer-form-page">
      <Link className="back-link" href="/customers"><ChevronLeft aria-hidden="true" size={16} />Customers</Link>
      <section className="page-heading"><div><p className="eyebrow">New customer</p><h1>Add customer</h1><p className="page-description">Create a customer record for contact details, service locations, and future work.</p></div></section>
      <CustomerForm action={createCustomerAction} submitLabel="Create customer" />
    </div>
  );
}

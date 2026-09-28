import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { updateEnquiryAction } from "@/app/actions/enquiries";
import { EnquiryForm } from "@/components/enquiries/enquiry-form";
import { getEnquiry, requireEnquiryOfficeContext } from "@/lib/enquiries/data";
export const metadata: Metadata = { title: "Edit enquiry" };
export default async function EditEnquiryPage({ params }: { params: Promise<{ enquiryId: string }> }) { const { enquiryId } = await params; const { organization } = await requireEnquiryOfficeContext(); const enquiry = await getEnquiry(enquiryId, organization.id); if (!enquiry.customer_id) throw new Error("This legacy enquiry is not linked to a customer."); const action = updateEnquiryAction.bind(null, enquiry.id, enquiry.customer_id); return <div className="page-stack customer-form-page"><Link className="back-link" href={`/enquiries/${enquiry.id}`}><ChevronLeft size={16} />Enquiry</Link><section className="page-heading"><div><p className="eyebrow">Enquiry</p><h1>Edit enquiry</h1><p className="page-description">Update the request, priority, source, or workflow status.</p></div></section><EnquiryForm action={action} enquiry={enquiry} /></div>; }

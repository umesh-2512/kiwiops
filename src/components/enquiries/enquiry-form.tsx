"use client";
import Link from "next/link";
import { useActionState } from "react";
import { FieldError } from "@/components/auth/field-error";
import { enquiryPriorities, enquiryPriorityLabels, enquirySources, enquirySourceLabels, enquiryStatuses, enquiryStatusLabels, type Enquiry } from "@/lib/enquiries/types";
import { initialEnquiryState, type EnquiryActionState } from "@/lib/enquiries/validation";
type CustomerOption = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null };
export function EnquiryForm({ action, customers, enquiry }: { action: (s: EnquiryActionState, f: FormData) => Promise<EnquiryActionState>; customers?: CustomerOption[]; enquiry?: Enquiry }) {
  const [state, formAction, pending] = useActionState(action, initialEnquiryState);
  return <form action={formAction} className="customer-form">
    {!enquiry ? <section className="form-section"><div className="form-section-heading"><p className="eyebrow">Customer</p><h2>Choose an active customer</h2><p>Search above to narrow the list. Only customers in this workspace are available.</p></div><div className="form-section-fields customer-choice-list">{customers?.map(c => <label className="customer-choice" key={c.id}><input name="customerId" required type="radio" value={c.id} /><span><strong>{c.first_name} {c.last_name}</strong><small>{c.email || c.phone || "No contact details"}</small></span></label>)}<FieldError errors={state.fieldErrors?.customerId} id="customerId-error" /></div></section> : null}
    <section className="form-section"><div className="form-section-heading"><p className="eyebrow">Request</p><h2>Enquiry details</h2><p>Record what the customer needs and how the request arrived.</p></div><div className="form-section-fields">
      <div className="field-group"><label htmlFor="category">Category</label><input defaultValue={enquiry?.category ?? ""} id="category" maxLength={100} name="category" placeholder="e.g. Repair, installation, regular service" /><FieldError errors={state.fieldErrors?.category} id="category-error" /></div>
      <div className="field-group"><label htmlFor="description">Description</label><textarea aria-invalid={Boolean(state.fieldErrors?.description)} defaultValue={enquiry?.description ?? ""} id="description" maxLength={5000} name="description" required rows={7} /><FieldError errors={state.fieldErrors?.description} id="description-error" /></div>
      <div className="field-row"><div className="field-group"><label htmlFor="source">Source</label><select defaultValue={enquiry?.source ?? "phone"} id="source" name="source">{enquirySources.map(v => <option key={v} value={v}>{enquirySourceLabels[v]}</option>)}</select><FieldError errors={state.fieldErrors?.source} id="source-error" /></div><div className="field-group"><label htmlFor="priority">Priority</label><select defaultValue={enquiry?.priority ?? "medium"} id="priority" name="priority">{enquiryPriorities.map(v => <option key={v} value={v}>{enquiryPriorityLabels[v]}</option>)}</select><FieldError errors={state.fieldErrors?.priority} id="priority-error" /></div></div>
      {enquiry ? <div className="field-group"><label htmlFor="status">Status</label><select defaultValue={enquiry.status} id="status" name="status">{enquiryStatuses.map(v => <option key={v} value={v}>{enquiryStatusLabels[v]}</option>)}</select><FieldError errors={state.fieldErrors?.status} id="status-error" /></div> : null}
    </div></section>
    {state.message ? <p className="form-message form-message-error" aria-live="polite">{state.message}</p> : null}<div className="form-actions"><Link className="button button-secondary" href={enquiry ? `/enquiries/${enquiry.id}` : "/enquiries"}>Cancel</Link><button className="button button-primary" disabled={pending} type="submit">{pending ? (enquiry ? "Updating..." : "Creating enquiry...") : (enquiry ? "Save changes" : "Create enquiry")}</button></div>
  </form>;
}

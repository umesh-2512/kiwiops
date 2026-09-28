"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError } from "@/components/auth/field-error";
import type { Customer } from "@/lib/customers/types";
import {
  initialCustomerState,
  type CustomerActionState,
} from "@/lib/customers/validation";

type CustomerFormProps = {
  action: (state: CustomerActionState, formData: FormData) => Promise<CustomerActionState>;
  customer?: Customer;
  submitLabel: string;
};

function describedBy(field: string, state: CustomerActionState) {
  return state.fieldErrors?.[field]?.length ? `${field}-error` : undefined;
}

export function CustomerForm({ action, customer, submitLabel }: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialCustomerState);

  return (
    <form action={formAction} className="customer-form">
      <section className="form-section" aria-labelledby="customer-identity-title">
        <div className="form-section-heading">
          <p className="eyebrow">Customer identity</p>
          <h2 id="customer-identity-title">Name and contact</h2>
          <p>The current customer schema supports individual customer records.</p>
        </div>
        <div className="form-section-fields">
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="firstName">First name</label>
              <input aria-describedby={describedBy("firstName", state)} aria-invalid={Boolean(state.fieldErrors?.firstName)} defaultValue={customer?.first_name ?? ""} id="firstName" maxLength={100} name="firstName" required />
              <FieldError errors={state.fieldErrors?.firstName} id="firstName-error" />
            </div>
            <div className="field-group">
              <label htmlFor="lastName">Last name</label>
              <input aria-describedby={describedBy("lastName", state)} aria-invalid={Boolean(state.fieldErrors?.lastName)} defaultValue={customer?.last_name ?? ""} id="lastName" maxLength={100} name="lastName" required />
              <FieldError errors={state.fieldErrors?.lastName} id="lastName-error" />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input aria-describedby={describedBy("email", state)} aria-invalid={Boolean(state.fieldErrors?.email)} autoComplete="email" defaultValue={customer?.email ?? ""} id="email" maxLength={254} name="email" type="email" />
              <FieldError errors={state.fieldErrors?.email} id="email-error" />
            </div>
            <div className="field-group">
              <label htmlFor="phone">Phone</label>
              <input aria-describedby={describedBy("phone", state)} aria-invalid={Boolean(state.fieldErrors?.phone)} autoComplete="tel" defaultValue={customer?.phone ?? ""} id="phone" maxLength={30} name="phone" type="tel" />
              <FieldError errors={state.fieldErrors?.phone} id="phone-error" />
            </div>
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="customer-address-title">
        <div className="form-section-heading">
          <p className="eyebrow">Service address</p>
          <h2 id="customer-address-title">Location</h2>
          <p>Use the address where work is usually carried out.</p>
        </div>
        <div className="form-section-fields">
          <div className="field-group">
            <label htmlFor="addressLine1">Address line 1</label>
            <input defaultValue={customer?.address_line_1 ?? ""} id="addressLine1" maxLength={160} name="addressLine1" autoComplete="address-line1" />
            <FieldError errors={state.fieldErrors?.addressLine1} id="addressLine1-error" />
          </div>
          <div className="field-group">
            <label htmlFor="addressLine2">Address line 2</label>
            <input defaultValue={customer?.address_line_2 ?? ""} id="addressLine2" maxLength={160} name="addressLine2" autoComplete="address-line2" />
            <FieldError errors={state.fieldErrors?.addressLine2} id="addressLine2-error" />
          </div>
          <div className="address-grid">
            <div className="field-group">
              <label htmlFor="suburb">Suburb</label>
              <input defaultValue={customer?.suburb ?? ""} id="suburb" maxLength={100} name="suburb" />
              <FieldError errors={state.fieldErrors?.suburb} id="suburb-error" />
            </div>
            <div className="field-group">
              <label htmlFor="city">City</label>
              <input defaultValue={customer?.city ?? ""} id="city" maxLength={100} name="city" autoComplete="address-level2" />
              <FieldError errors={state.fieldErrors?.city} id="city-error" />
            </div>
            <div className="field-group">
              <label htmlFor="postcode">Postcode</label>
              <input defaultValue={customer?.postcode ?? ""} id="postcode" maxLength={20} name="postcode" autoComplete="postal-code" />
              <FieldError errors={state.fieldErrors?.postcode} id="postcode-error" />
            </div>
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="customer-notes-title">
        <div className="form-section-heading">
          <p className="eyebrow">Internal context</p>
          <h2 id="customer-notes-title">Notes</h2>
          <p>Visible to authorized office users in this workspace.</p>
        </div>
        <div className="form-section-fields">
          <div className="field-group">
            <label htmlFor="notes">Customer notes</label>
            <textarea defaultValue={customer?.notes ?? ""} id="notes" maxLength={5000} name="notes" rows={6} />
            <FieldError errors={state.fieldErrors?.notes} id="notes-error" />
          </div>
        </div>
      </section>

      {state.message ? <p aria-live="polite" className="form-message form-message-error">{state.message}</p> : null}

      <div className="form-actions">
        <Link className="button button-secondary" href={customer ? `/customers/${customer.id}` : "/customers"}>Cancel</Link>
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? (customer ? "Updating..." : "Creating customer...") : submitLabel}
        </button>
      </div>
    </form>
  );
}

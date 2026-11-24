"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LockKeyhole } from "lucide-react";
import { updateBusinessSettingsAction } from "@/app/actions/settings";
import { FieldError } from "@/components/auth/field-error";
import { initialSettingsState } from "@/lib/settings/validation";
import type { BusinessSettings } from "@/lib/settings/types";

const nzTimezones = ["Pacific/Auckland", "Pacific/Chatham"];

export function BusinessSettingsForm({ canEdit, settings }: { canEdit: boolean; settings: BusinessSettings }) {
  const [state, action, pending] = useActionState(updateBusinessSettingsAction, initialSettingsState);
  const [gstRegistered, setGstRegistered] = useState(settings.gst_registered);
  const [dirty, setDirty] = useState(false);
  const timezones = nzTimezones.includes(settings.timezone) ? nzTimezones : [settings.timezone, ...nzTimezones];

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty && !pending) event.preventDefault(); };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, pending]);
  useEffect(() => {
    if (state.status !== "success") return;
    const frame = requestAnimationFrame(() => setDirty(false));
    return () => cancelAnimationFrame(frame);
  }, [state.status]);

  const described = (field: string) => state.fieldErrors?.[field] ? `${field}-error` : undefined;
  return (
    <form action={action} className="settings-form" onChange={() => setDirty(true)} noValidate>
      <input name="expectedUpdatedAt" type="hidden" value={settings.updated_at} />
      <section className={`settings-readiness ${settings.financial_ready ? "settings-ready" : "settings-not-ready"}`} aria-live="polite">
        {settings.financial_ready ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
        <div><strong>{settings.financial_ready ? "Ready to issue financial documents" : "Business settings need confirmation"}</strong><p>{settings.financial_ready ? "Quotes and invoices can use the confirmed GST configuration below." : "Complete the required business and GST fields before issuing quotes or invoices."}</p></div>
      </section>

      {!canEdit ? <p className="settings-admin-note"><LockKeyhole aria-hidden="true" size={17} />You can review these settings. Only the workspace owner can change them.</p> : null}

      <fieldset disabled={!canEdit || pending}>
        <section className="settings-card" aria-labelledby="business-information-heading">
          <header><div><p className="eyebrow">Business information</p><h2 id="business-information-heading">Customer-facing details</h2></div><p>These details are captured when a quote or invoice is issued.</p></header>
          <div className="settings-fields settings-fields-two">
            <div className="field-group"><label htmlFor="legalName">Legal business name</label><input aria-describedby={described("legalName")} aria-invalid={Boolean(state.fieldErrors?.legalName)} defaultValue={settings.legal_name ?? ""} id="legalName" name="legalName" required /><FieldError errors={state.fieldErrors?.legalName} id="legalName-error" /></div>
            <div className="field-group"><label htmlFor="tradingName">Trading name</label><input aria-describedby={described("tradingName")} aria-invalid={Boolean(state.fieldErrors?.tradingName)} defaultValue={settings.trading_name} id="tradingName" name="tradingName" required /><FieldError errors={state.fieldErrors?.tradingName} id="tradingName-error" /></div>
            <div className="field-group"><label htmlFor="businessEmail">Business email</label><input aria-describedby={described("businessEmail")} aria-invalid={Boolean(state.fieldErrors?.businessEmail)} autoComplete="email" defaultValue={settings.business_email ?? ""} id="businessEmail" name="businessEmail" required type="email" /><FieldError errors={state.fieldErrors?.businessEmail} id="businessEmail-error" /></div>
            <div className="field-group"><label htmlFor="businessPhone">Business phone <span>Optional</span></label><input autoComplete="tel" defaultValue={settings.business_phone ?? ""} id="businessPhone" name="businessPhone" type="tel" /></div>
            <div className="field-group settings-wide"><label htmlFor="addressLine1">Street address</label><input aria-describedby={described("addressLine1")} aria-invalid={Boolean(state.fieldErrors?.addressLine1)} autoComplete="address-line1" defaultValue={settings.address_line_1 ?? ""} id="addressLine1" name="addressLine1" required /><FieldError errors={state.fieldErrors?.addressLine1} id="addressLine1-error" /></div>
            <div className="field-group settings-wide"><label htmlFor="addressLine2">Address line 2 <span>Optional</span></label><input autoComplete="address-line2" defaultValue={settings.address_line_2 ?? ""} id="addressLine2" name="addressLine2" /></div>
            <div className="field-group"><label htmlFor="suburb">Suburb <span>Optional</span></label><input defaultValue={settings.suburb ?? ""} id="suburb" name="suburb" /></div>
            <div className="field-group"><label htmlFor="city">City or town</label><input aria-describedby={described("city")} aria-invalid={Boolean(state.fieldErrors?.city)} autoComplete="address-level2" defaultValue={settings.city ?? ""} id="city" name="city" required /><FieldError errors={state.fieldErrors?.city} id="city-error" /></div>
            <div className="field-group"><label htmlFor="postcode">Postcode</label><input aria-describedby={described("postcode")} aria-invalid={Boolean(state.fieldErrors?.postcode)} autoComplete="postal-code" defaultValue={settings.postcode ?? ""} id="postcode" inputMode="numeric" maxLength={4} name="postcode" required /><FieldError errors={state.fieldErrors?.postcode} id="postcode-error" /></div>
            <div className="field-group"><label htmlFor="nzbn">NZBN <span>Optional</span></label><input aria-describedby={described("nzbn")} aria-invalid={Boolean(state.fieldErrors?.nzbn)} defaultValue={settings.nzbn ?? ""} id="nzbn" inputMode="numeric" maxLength={13} name="nzbn" /><FieldError errors={state.fieldErrors?.nzbn} id="nzbn-error" /></div>
          </div>
        </section>

        <section className="settings-card" aria-labelledby="gst-heading">
          <header><div><p className="eyebrow">GST configuration</p><h2 id="gst-heading">New Zealand GST</h2></div><p>GST is charged at the standard 15% rate only when the business is registered.</p></header>
          <fieldset className="settings-choice" aria-describedby="gst-help">
            <legend>Is this business GST registered?</legend>
            <label><input checked={gstRegistered} name="gstStatus" onChange={() => setGstRegistered(true)} type="radio" value="registered" />Yes, GST registered</label>
            <label><input checked={!gstRegistered} name="gstStatus" onChange={() => setGstRegistered(false)} type="radio" value="not_registered" />No, not GST registered</label>
            <p id="gst-help">Your GST number is the same as your IRD number. KiwiOps checks the 8 or 9 digit format and checksum, not whether the business is currently registered with Inland Revenue.</p>
            <FieldError errors={state.fieldErrors?.gstStatus} id="gstStatus-error" />
          </fieldset>
          {gstRegistered ? <div className="settings-fields settings-fields-two settings-gst-fields"><div className="field-group"><label htmlFor="gstNumber">GST number</label><input aria-describedby={described("gstNumber")} aria-invalid={Boolean(state.fieldErrors?.gstNumber)} defaultValue={settings.gst_number ?? ""} id="gstNumber" inputMode="numeric" name="gstNumber" placeholder="123-456-789" required /><FieldError errors={state.fieldErrors?.gstNumber} id="gstNumber-error" /></div><div className="field-group"><label htmlFor="gstRate">Standard GST rate</label><input aria-describedby="gst-rate-help" disabled id="gstRate" value="15%" /><p className="field-help" id="gst-rate-help">The supported New Zealand standard rate is fixed.</p></div></div> : <p className="settings-zero-gst">New quote and invoice drafts will use a 0% tax rate. Existing issued documents will not change.</p>}
        </section>

        <section className="settings-card" aria-labelledby="regional-heading">
          <header><div><p className="eyebrow">Regional preferences</p><h2 id="regional-heading">Dates and payment terms</h2></div><p>Timezone controls local schedule and document dates.</p></header>
          <div className="settings-fields settings-fields-three">
            <div className="field-group"><label htmlFor="currency">Currency</label><input id="currency" name="currency" readOnly value="NZD" /><p className="field-help">KiwiOps currently supports NZD only.</p><FieldError errors={state.fieldErrors?.currency} id="currency-error" /></div>
            <div className="field-group"><label htmlFor="timezone">Organization timezone</label><select defaultValue={settings.timezone} id="timezone" name="timezone">{timezones.map((zone) => <option key={zone} value={zone}>{zone.replace("_", " ")}</option>)}</select><FieldError errors={state.fieldErrors?.timezone} id="timezone-error" /></div>
            <div className="field-group"><label htmlFor="paymentTerms">Default payment terms</label><select defaultValue={String(settings.invoice_payment_terms_days)} id="paymentTerms" name="paymentTerms"><option value="0">Due on receipt</option><option value="7">7 days</option><option value="14">14 days</option><option value="20">20 days</option><option value="30">30 days</option></select><FieldError errors={state.fieldErrors?.paymentTerms} id="paymentTerms-error" /></div>
          </div>
        </section>
      </fieldset>

      {state.message ? <p className={`form-message form-message-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      {canEdit ? <footer className="settings-save"><div>{dirty ? <span>Unsaved changes</span> : <span>All changes saved</span>}<small>Issued documents keep their original snapshots and totals.</small></div><button className="button button-primary" disabled={pending} type="submit">{pending ? "Saving settings..." : "Save business settings"}</button></footer> : null}
    </form>
  );
}

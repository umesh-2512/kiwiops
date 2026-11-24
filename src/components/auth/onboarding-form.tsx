"use client";

import { useActionState, useState } from "react";
import { createWorkspaceAction } from "@/app/actions/auth";
import { initialAuthState } from "@/lib/auth/validation";
import { FieldError } from "./field-error";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, initialAuthState);
  const [gstStatus, setGstStatus] = useState<"registered" | "not_registered" | null>(null);

  return (
    <form action={action} className="auth-form" noValidate>
      <div className="field-group">
        <label htmlFor="business-name">Business name</label>
        <input
          aria-describedby={state.fieldErrors?.businessName ? "business-name-error" : "business-name-help"}
          aria-invalid={Boolean(state.fieldErrors?.businessName)}
          autoComplete="organization"
          id="business-name"
          name="businessName"
          placeholder="Southern Pools & Spa Ltd"
          required
        />
        <p className="field-help" id="business-name-help">This becomes the name of your KiwiOps workspace.</p>
        <FieldError errors={state.fieldErrors?.businessName} id="business-name-error" />
      </div>

      <fieldset className="onboarding-gst-choice">
        <legend>Is your business registered for GST?</legend>
        <p>Choose one. KiwiOps will not assume your GST status.</p>
        <label><input checked={gstStatus === "registered"} name="gstStatus" onChange={() => setGstStatus("registered")} type="radio" value="registered" />Yes, GST registered</label>
        <label><input checked={gstStatus === "not_registered"} name="gstStatus" onChange={() => setGstStatus("not_registered")} type="radio" value="not_registered" />No, not GST registered</label>
        <FieldError errors={state.fieldErrors?.gstStatus} id="gst-status-error" />
      </fieldset>

      {gstStatus === "registered" ? <div className="field-group"><label htmlFor="gst-number">GST number</label><input aria-describedby={state.fieldErrors?.gstNumber ? "gst-number-error" : "gst-number-help"} aria-invalid={Boolean(state.fieldErrors?.gstNumber)} id="gst-number" inputMode="numeric" name="gstNumber" placeholder="123-456-789" required /><p className="field-help" id="gst-number-help">Your GST number is the same as your IRD number.</p><FieldError errors={state.fieldErrors?.gstNumber} id="gst-number-error" /></div> : null}

      {state.message ? <p className="form-message form-message-error" role="alert">{state.message}</p> : null}

      <button className="button button-primary auth-submit" disabled={pending} type="submit">
        {pending ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  );
}

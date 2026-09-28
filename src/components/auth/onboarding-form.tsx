"use client";

import { useActionState } from "react";
import { createWorkspaceAction } from "@/app/actions/auth";
import { initialAuthState } from "@/lib/auth/validation";
import { FieldError } from "./field-error";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, initialAuthState);

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

      {state.message ? <p className="form-message form-message-error" role="alert">{state.message}</p> : null}

      <button className="button button-primary auth-submit" disabled={pending} type="submit">
        {pending ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/app/actions/auth";
import { FieldError } from "./field-error";
import { initialAuthState } from "@/lib/auth/validation";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, initialAuthState);

  if (state.status === "success") {
    return (
      <div className="auth-success" role="status">
        <span aria-hidden="true">✓</span>
        <h3>Confirm your email</h3>
        <p>{state.message}</p>
        <Link className="button button-secondary" href="/login">Return to sign in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="auth-form" noValidate>
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="first-name">First name</label>
          <input
            aria-describedby={state.fieldErrors?.firstName ? "first-name-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors?.firstName)}
            autoComplete="given-name"
            id="first-name"
            name="firstName"
            required
          />
          <FieldError errors={state.fieldErrors?.firstName} id="first-name-error" />
        </div>
        <div className="field-group">
          <label htmlFor="last-name">Last name</label>
          <input
            aria-describedby={state.fieldErrors?.lastName ? "last-name-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors?.lastName)}
            autoComplete="family-name"
            id="last-name"
            name="lastName"
            required
          />
          <FieldError errors={state.fieldErrors?.lastName} id="last-name-error" />
        </div>
      </div>
      <div className="field-group">
        <label htmlFor="signup-email">Email</label>
        <input
          aria-describedby={state.fieldErrors?.email ? "signup-email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          id="signup-email"
          name="email"
          placeholder="you@business.co.nz"
          required
          type="email"
        />
        <FieldError errors={state.fieldErrors?.email} id="signup-email-error" />
      </div>
      <div className="field-group">
        <label htmlFor="signup-password">Password</label>
        <input
          aria-describedby="password-help signup-password-error"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="new-password"
          id="signup-password"
          name="password"
          required
          type="password"
        />
        <p className="field-help" id="password-help">At least 10 characters, including a letter and a number.</p>
        <FieldError errors={state.fieldErrors?.password} id="signup-password-error" />
      </div>
      <div className="field-group">
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          aria-describedby={state.fieldErrors?.confirmPassword ? "confirm-password-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          autoComplete="new-password"
          id="confirm-password"
          name="confirmPassword"
          required
          type="password"
        />
        <FieldError errors={state.fieldErrors?.confirmPassword} id="confirm-password-error" />
      </div>

      {state.message ? <p className="form-message form-message-error" role="alert">{state.message}</p> : null}

      <button className="button button-primary auth-submit" disabled={pending} type="submit">
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}

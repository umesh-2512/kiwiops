"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth";
import { FieldError } from "./field-error";
import { initialAuthState } from "@/lib/auth/validation";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signInAction, initialAuthState);

  return (
    <form action={action} className="auth-form" noValidate>
      <input name="next" type="hidden" value={nextPath} />
      <div className="field-group">
        <label htmlFor="login-email">Email</label>
        <input
          aria-describedby={state.fieldErrors?.email ? "login-email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          id="login-email"
          name="email"
          placeholder="you@business.co.nz"
          required
          type="email"
        />
        <FieldError errors={state.fieldErrors?.email} id="login-email-error" />
      </div>
      <div className="field-group">
        <label htmlFor="login-password">Password</label>
        <input
          aria-describedby={state.fieldErrors?.password ? "login-password-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="current-password"
          id="login-password"
          name="password"
          required
          type="password"
        />
        <FieldError errors={state.fieldErrors?.password} id="login-password-error" />
      </div>

      {state.message ? <p className="form-message form-message-error" role="alert">{state.message}</p> : null}

      <button className="button button-primary auth-submit" disabled={pending} type="submit">
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p className="auth-switch">
        New to KiwiOps? <Link href="/signup">Create an account</Link>
      </p>
    </form>
  );
}

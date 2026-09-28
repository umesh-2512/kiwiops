import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getViewerContext } from "@/lib/auth/context";
import { safeAppRedirect } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string }>;
}) {
  const viewer = await getViewerContext();
  const params = await searchParams;
  if (viewer?.organization) redirect(safeAppRedirect(params.next));
  if (viewer) redirect("/onboarding");

  const statusMessage = params.status === "confirmation-error"
    ? "That confirmation link is invalid or has expired. Request a new account confirmation by signing up again."
    : params.status === "profile-error"
      ? "Your email was confirmed, but KiwiOps could not prepare your profile. Sign in to try again."
      : null;

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to your workspace">
      {statusMessage ? <p className="form-message form-message-error" role="alert">{statusMessage}</p> : null}
      <LoginForm nextPath={safeAppRedirect(params.next)} />
    </AuthShell>
  );
}

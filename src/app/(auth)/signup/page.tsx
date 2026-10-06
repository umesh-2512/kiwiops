import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getViewerContext } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const viewer = await getViewerContext();
  if (viewer?.organization) redirect("/");
  if (viewer) redirect("/onboarding");

  return (
    <AuthShell description="Set up your workspace and start managing your operations in one place." title="Create your KiwiOps account">
      <SignupForm />
    </AuthShell>
  );
}

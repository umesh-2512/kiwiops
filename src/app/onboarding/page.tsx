import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getViewerContext } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login");
  if (viewer.organization) redirect("/");

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="onboarding-brand">
          <span className="brand-mark" aria-hidden="true"><Wrench size={17} strokeWidth={2.2} /></span>
          <span>KiwiOps</span>
        </div>
        <div className="onboarding-progress" aria-label="Setup progress">
          <span className="onboarding-progress-active">Account</span>
          <i />
          <span className="onboarding-progress-active">Workspace</span>
        </div>
        <div className="auth-heading onboarding-heading">
          <p className="eyebrow">Welcome, {viewer.firstName}</p>
          <h1>Let&apos;s set up your business.</h1>
          <p>Create the workspace your team will use to run day-to-day operations.</p>
        </div>
        <OnboardingForm />
        <p className="onboarding-security">Your account becomes the workspace owner. KiwiOps enforces that role in the database.</p>
      </section>
    </main>
  );
}

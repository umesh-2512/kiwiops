import { Wrench } from "lucide-react";
import Link from "next/link";

export function AuthShell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="About KiwiOps">
        <Link className="auth-brand" href="/login" aria-label="KiwiOps sign in">
          <span className="brand-mark" aria-hidden="true">
            <Wrench size={17} strokeWidth={2.2} />
          </span>
          <span>KiwiOps</span>
        </Link>
        <div className="auth-intro-copy">
          <p className="eyebrow">Service operations, organised</p>
          <h1>Run your service business with clarity.</h1>
          <p>
            Keep customers, field work, quotes, and billing connected in one
            focused workspace.
          </p>
        </div>
        <p className="auth-region">Built for New Zealand service businesses.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

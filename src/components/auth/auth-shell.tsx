import { Wrench } from "lucide-react";
import Link from "next/link";

export function AuthShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/login" aria-label="KiwiOps sign in">
          <span className="brand-mark" aria-hidden="true">
            <Wrench size={17} strokeWidth={2.2} />
          </span>
          <span>KiwiOps</span>
        </Link>
        <div className="auth-card">
          <div className="auth-heading">
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </div>
        <p className="auth-panel-foot">Service operations, organised.</p>
      </section>

      <section className="auth-intro" aria-label="About KiwiOps">
        <div className="auth-visual" aria-hidden="true">
          <span className="auth-orbit auth-orbit-one" />
          <span className="auth-orbit auth-orbit-two" />
          <span className="auth-glow auth-glow-one" />
          <span className="auth-glow auth-glow-two" />
          <span className="auth-grid" />
        </div>
        <div className="auth-intro-copy">
          <p className="auth-kicker">One connected workspace</p>
          <h2>Run your service business<br />from one place.</h2>
          <p className="auth-workflow">Enquiries <i /> Quotes <i /> Jobs <i /> Invoices <i /> Payments</p>
        </div>
        <div className="auth-industries">
          <p>Built for New Zealand service businesses</p>
          <ul aria-label="Service business categories">
            <li>Pool Services</li><li>Electrical</li><li>Plumbing</li><li>Cleaning</li><li>Landscaping</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

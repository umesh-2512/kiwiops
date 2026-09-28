import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <span className="empty-mark" aria-hidden="true">404</span>
      <p className="eyebrow">Page not found</p>
      <h1>This workspace doesn&apos;t exist.</h1>
      <p>Return to the dashboard to continue working in KiwiOps.</p>
      <Link className="button button-primary" href="/">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to dashboard
      </Link>
    </div>
  );
}

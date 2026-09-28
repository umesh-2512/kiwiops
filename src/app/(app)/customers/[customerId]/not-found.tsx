import Link from "next/link";

export default function CustomerNotFound() {
  return (
    <section className="route-error">
      <span className="empty-mark" aria-hidden="true">404</span>
      <p className="eyebrow">Customer unavailable</p>
      <h1>Customer not found</h1>
      <p>This customer does not exist in your workspace, or your role does not allow access.</p>
      <Link className="button button-primary" href="/customers">Back to customers</Link>
    </section>
  );
}

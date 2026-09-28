"use client";

import { useEffect } from "react";

export default function CustomersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Customer route failed", error); }, [error]);
  return (
    <section className="route-error">
      <span className="empty-mark" aria-hidden="true">!</span>
      <p className="eyebrow">Customer data unavailable</p>
      <h1>We couldn’t load customers.</h1>
      <p>Check the connection and try again. No customer data was changed.</p>
      <button className="button button-primary" onClick={reset} type="button">Try again</button>
    </section>
  );
}

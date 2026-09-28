"use client";
import { useEffect } from "react";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) { useEffect(() => console.error("Enquiry route failed", error), [error]); return <section className="route-error"><span className="empty-mark">!</span><p className="eyebrow">Enquiries unavailable</p><h1>We couldn’t load enquiries.</h1><p>Check the connection and try again. No enquiry data was changed.</p><button className="button button-primary" onClick={reset}>Try again</button></section>; }

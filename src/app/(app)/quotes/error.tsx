"use client";
import { AlertTriangle } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="route-error"><span className="empty-mark"><AlertTriangle size={22} /></span><p className="eyebrow">Quotes unavailable</p><h1>We could not load quotes.</h1><p>Check the connection and try again.</p><button className="button button-primary" onClick={reset}>Try again</button></section>; }

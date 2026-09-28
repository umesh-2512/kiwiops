import Link from "next/link";
export default function NotFound() { return <section className="not-found"><p className="eyebrow">Quote unavailable</p><h1>We could not find that quote.</h1><p>It may not exist in this workspace, or you may not have access to it.</p><Link className="button button-primary" href="/quotes">Back to quotes</Link></section>; }

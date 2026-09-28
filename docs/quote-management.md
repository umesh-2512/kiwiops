# Quote management

Milestone 6 adds organization-scoped quote list, search, status filters, pagination, draft editing, issuing, outcomes, and Customer/Enquiry context.

## Financial model

Money is stored as integer cents. Quantity is `numeric(12,3)`. PostgreSQL calculates each line subtotal with `round(quantity * unit_price_cents)`, then calculates line tax with `round(line_subtotal_cents * tax_rate / 100)`. Quote totals are sums maintained by database triggers. Browser totals are previews and are never submitted as authoritative totals.

The organization setting supplies currency, quote validity, GST registration, and the default GST rate. Currency is copied onto the quote and tax rate is copied onto each line, so later settings changes do not recalculate existing documents. The approved schema does not include customer or business-address snapshot columns. Historical customer contact display therefore follows the linked customer record; adding a full party snapshot requires a separately approved schema change.

## Lifecycle and numbering

`draft` quotes are editable. Issuing changes the stored status to `sent`, records `sent_at`, locks document content through the existing lifecycle trigger, and advances a linked `new` or `reviewing` enquiry to `quoted`. An issued quote may move once to `accepted` or `rejected`. Expiry is derived when a sent quote's expiry date has passed.

Quote numbers are allocated at draft creation by the existing concurrency-safe `document_sequences` function. UUIDs remain internal identifiers.

## Security and operations

Migration `20260929000700_quote_operations.sql` adds controlled `SECURITY DEFINER` functions for settings lookup, draft creation, atomic draft replacement, issuing, and outcomes. Each mutation checks the authenticated user's owner/admin membership and validates same-organization customer/enquiry relationships. New quotes require active customers; linked enquiries must belong to that customer and cannot be closed.

Direct authenticated writes to `quotes` and `quote_items` are revoked. Existing forced RLS remains the read boundary. Technicians have no quote policies or RPC authorization. Issue and outcome events, plus meaningful draft changes, are recorded in `activity_logs` in the same transaction.

Draft replacement uses the previously read `updated_at` value to reject a stale save. Document numbers remain unique under simultaneous creation. Repeated issue or outcome requests fail the lifecycle check rather than altering an already transitioned document.

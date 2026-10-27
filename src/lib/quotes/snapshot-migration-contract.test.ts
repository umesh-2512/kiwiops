import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261015001300_quote_snapshots.sql"),
  "utf8",
);

describe("quote snapshot migration contract", () => {
  it("adds the established customer, business, GST, and tax snapshot fields", () => {
    for (const column of [
      "customer_name_snapshot",
      "customer_email_snapshot",
      "customer_phone_snapshot",
      "billing_address_line_1_snapshot",
      "business_name_snapshot",
      "business_email_snapshot",
      "business_phone_snapshot",
      "business_gst_number_snapshot",
      "business_gst_registered_snapshot",
      "tax_rate_snapshot",
    ]) expect(sql).toContain(column);
  });

  it("captures snapshots from trusted customer, settings, and quote-item rows", () => {
    expect(sql).toContain("v_customer public.customers%rowtype");
    expect(sql).toContain("v_settings public.business_settings%rowtype");
    expect(sql).toContain("select max(item.tax_rate) into strict v_tax_rate");
    expect(sql).not.toMatch(/p_.*snapshot/i);
  });

  it("keeps the existing financial and lifecycle guards", () => {
    expect(sql).toContain("new.subtotal_cents is distinct from old.subtotal_cents");
    expect(sql).toContain("new.tax_cents is distinct from old.tax_cents");
    expect(sql).toContain("new.total_cents is distinct from old.total_cents");
    expect(sql).toContain("Only a draft quote may be issued");
    expect(sql).not.toMatch(/insert\s+into\s+public\.quote_items/i);
  });

  it("makes issued snapshots immutable and requires their integrity fields", () => {
    expect(sql).toContain("Issued quote content is immutable");
    expect(sql).toContain("quotes_issued_snapshot_check");
    expect(sql).toContain("new.customer_name_snapshot is distinct from old.customer_name_snapshot");
    expect(sql).toContain("new.tax_rate_snapshot is distinct from old.tax_rate_snapshot");
  });

  it("backfills existing non-draft quotes without deleting records", () => {
    expect(sql).toMatch(/update public\.quotes as quote[\s\S]+where quote\.status <> 'draft'/);
    expect(sql).toContain("from public.customers as customer, public.business_settings as settings");
    expect(sql).not.toMatch(/\b(delete|truncate|drop table|drop schema)\b/i);
  });

  it("keeps live draft business access owner/admin only", () => {
    expect(sql).toContain("public.get_quote_document_business(p_organization_id uuid)");
    expect(sql).toContain("private.has_org_role(p_organization_id, array['owner', 'admin'])");
    expect(sql).toContain("revoke all on function public.get_quote_document_business(uuid) from public, anon");
    expect(sql).toContain("grant execute on function public.get_quote_document_business(uuid) to authenticated");
  });

  it("does not alter RLS policies or table privileges", () => {
    expect(sql).not.toMatch(/row level security|create policy|alter policy/i);
    expect(sql).not.toMatch(/grant (select|insert|update|delete) on/i);
  });
});

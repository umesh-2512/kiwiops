import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261124001600_business_settings.sql"), "utf8");

describe("business settings migration contract", () => {
  it("adds confirmation metadata without rewriting existing GST values", () => {
    expect(sql).toContain("add column gst_settings_confirmed_at");
    expect(sql).not.toMatch(/update public\.business_settings set\s+gst_settings_confirmed_at/);
    expect(sql).not.toMatch(/drop table|truncate/i);
  });

  it("uses controlled fixed-search-path operations", () => {
    expect(sql).toContain("create or replace function public.update_business_settings");
    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).toContain("array['owner']");
    expect(sql).toContain("revoke update on public.business_settings from authenticated");
  });

  it("enforces readiness and stale tax review at quote and invoice issuance", () => {
    expect(sql.match(/perform private\.require_financial_readiness/g)).toHaveLength(2);
    expect(sql.match(/GST settings changed\. Review and save this draft/g)).toHaveLength(2);
    expect(sql.match(/for share/g)).toHaveLength(2);
    expect(sql).toContain("private.is_valid_nz_ird_number");
  });

  it("preserves issued snapshots and historical financial rows", () => {
    expect(sql).not.toMatch(/alter table public\.(quotes|invoices|quote_items|invoice_items|payments)/i);
    expect(sql).not.toMatch(/truncate|drop table/i);
    expect(sql).not.toContain("create or replace function private.guard_quote_lifecycle");
    expect(sql).not.toContain("create or replace function private.guard_invoice_lifecycle");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const data = readFileSync(join(process.cwd(), "src/lib/invoices/data.ts"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/(app)/invoices/page.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261109001500_invoice_listing.sql"), "utf8");

describe("invoice server pagination contract", () => {
  it("uses one bounded database RPC instead of loading 500 records", () => {
    expect(data).toContain('s.rpc("list_invoices"');
    expect(data).toContain("p_page_size:INVOICE_PAGE_SIZE");
    expect(data).not.toContain(".limit(500)");
    expect(data).not.toContain("filtered.slice");
  });

  it("uses deterministic tenant-scoped ordering and an exact filtered count", () => {
    expect(migration).toMatch(/where invoice\.organization_id = p_organization_id/i);
    expect(migration).toMatch(/order by created_at desc, id desc/i);
    expect(migration).toMatch(/select count\(\*\)::bigint from filtered/i);
    expect(migration).toMatch(/limit p_page_size\s+offset v_offset/i);
  });

  it("calculates balances only from active trusted payment rows", () => {
    expect(migration).toMatch(/payment\.voided_at is null/i);
    expect(migration).toMatch(/sum\(payment\.amount_cents\)/i);
    expect(migration).toMatch(/invoice\.total_cents - coalesce\(payment\.paid_cents, 0\)/i);
  });

  it("requires owner or admin membership and does not use dynamic SQL", () => {
    expect(migration).toMatch(/private\.has_org_role\(p_organization_id, array\['owner', 'admin'\]\)/i);
    expect(migration).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon/i);
    expect(migration).not.toMatch(/execute\s+format|service_role/i);
  });

  it("keeps out-of-range handling and filter state on the server page", () => {
    expect(page).toContain("if (params.page > pages && count) redirect");
    expect(page).toContain("Page {params.page} of {pages}");
    expect(page).not.toContain("getInvoiceDefaults");
  });

  it("retains responsive pagination controls", () => {
    expect(page).toContain('className="pagination"');
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.pagination/);
  });
});

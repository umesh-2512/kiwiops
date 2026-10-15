import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261007001200_smart_insights.sql"), "utf8");

describe("Smart Insights migration contract", () => {
  it("creates one narrow security-definer aggregate RPC with a fixed search path", () => {
    expect(migration).toContain("create or replace function public.get_smart_insights(p_organization_id uuid)");
    expect(migration).toMatch(/security definer\s+set search_path = ''/);
    expect(migration).not.toMatch(/execute\s+format|service_role/i);
  });

  it("derives identity from auth.uid and requires active owner or admin membership", () => {
    expect(migration).toContain("v_actor uuid := auth.uid()");
    expect(migration).toContain("private.has_org_role(p_organization_id, array['owner', 'admin'])");
  });

  it("grants only authenticated execution", () => {
    expect(migration).toContain("revoke all on function public.get_smart_insights(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.get_smart_insights(uuid) to authenticated");
    expect(migration).not.toMatch(/grant execute.+technician/i);
  });

  it("does not change data, RLS, policies, or table grants", () => {
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate|drop table|alter table)\b/i);
    expect(migration).not.toMatch(/row level security|create policy|grant (select|insert|update|delete) on/i);
  });

  it("uses the established overdue invoice and active-payment definition", () => {
    expect(migration).toContain("i.status = 'sent'");
    expect(migration).toContain("p.voided_at is null");
    expect(migration).toContain("greatest(i.total_cents - coalesce(pt.paid_cents, 0), 0)");
    expect(migration).toContain("i.due_date < v_today");
    expect(migration).toContain("o.balance_cents > 0");
  });

  it("implements urgent and one-calendar-day high enquiry rules", () => {
    expect(migration).toContain("e.priority = 'urgent'");
    expect(migration).toContain("e.priority = 'high'");
    expect(migration).toContain("e.status in ('new', 'reviewing')");
    expect(migration).toContain("(e.created_at at time zone v_settings.timezone)::date <= v_today - 1");
  });

  it("counts only unscheduled jobs for the scheduling insight", () => {
    expect(migration).toContain("j.status = 'unscheduled'");
  });

  it("treats only non-ended assignments as active", () => {
    expect(migration).toContain("a.unassigned_at is null");
    expect(migration).toContain("a.job_id = j.id");
  });

  it("excludes every completed job that has any invoice row", () => {
    expect(migration).toMatch(/j\.status = 'completed'[\s\S]+not exists \([\s\S]+from public\.invoices i[\s\S]+i\.job_id = j\.id/);
    expect(migration).not.toMatch(/i\.status\s+(?:not )?in/);
  });

  it("uses sent_at and a seven-calendar-day quote threshold", () => {
    expect(migration).toContain("q.status = 'sent'");
    expect(migration).toContain("q.sent_at is not null");
    expect(migration).toContain("(q.sent_at at time zone v_settings.timezone)::date <= v_today - 7");
  });

  it("uses trusted organization timezone for all date boundaries", () => {
    expect(migration).toContain("now() at time zone v_settings.timezone");
    expect(migration.match(/at time zone v_settings\.timezone/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("scopes all business sources to the supplied organization", () => {
    expect(migration.match(/organization_id = p_organization_id/g)?.length).toBeGreaterThanOrEqual(10);
  });

  it("returns aggregates rather than customer or document rows", () => {
    expect(migration).not.toMatch(/customer_(name|email|phone)|invoice_number|quote_number|job_number/);
    expect(migration).toContain("count(*)");
    expect(migration).toContain("sum(o.balance_cents)");
  });
});

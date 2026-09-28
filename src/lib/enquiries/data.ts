import "server-only";
import { notFound } from "next/navigation";
import { requireOfficeContext } from "@/lib/customers/data";
import { createClient } from "@/lib/supabase/server";
import { ENQUIRY_PAGE_SIZE } from "./query";
import type { Enquiry, EnquiryActivity, EnquiryPriority, EnquiryStatus } from "./types";
import { isEnquiryId } from "./validation";
const columns = "id,organization_id,customer_id,source,description,category,priority,status,closed_at,created_at,updated_at,customers(id,first_name,last_name,email,phone)";
export async function listEnquiries(p: { organizationId: string; page: number; query: string; status: EnquiryStatus | "all"; priority: EnquiryPriority | "all" }) {
  const supabase = await createClient(); const from = (p.page - 1) * ENQUIRY_PAGE_SIZE;
  let customerIds: string[] = [];
  if (p.query) { const pattern = `%${p.query}%`; const c = await supabase.from("customers").select("id").eq("organization_id", p.organizationId).or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`).limit(100); customerIds = (c.data ?? []).map(x => x.id); }
  let request = supabase.from("enquiries").select(columns, { count: "exact" }).eq("organization_id", p.organizationId).order("created_at", { ascending: false }).range(from, from + ENQUIRY_PAGE_SIZE - 1);
  if (p.status !== "all") request = request.eq("status", p.status); if (p.priority !== "all") request = request.eq("priority", p.priority);
  if (p.query) { const pattern = `%${p.query}%`; const customerFilter = customerIds.length ? `,customer_id.in.(${customerIds.join(",")})` : ""; request = request.or(`description.ilike.${pattern},category.ilike.${pattern}${customerFilter}`); }
  const result = await request; if (result.error) throw new Error("Unable to load enquiries.");
  return { enquiries: (result.data ?? []) as unknown as Enquiry[], count: result.count ?? 0 };
}
export async function getEnquiry(id: string, organizationId: string) { if (!isEnquiryId(id)) notFound(); const s = await createClient(); const r = await s.from("enquiries").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle(); if (r.error || !r.data) notFound(); return r.data as unknown as Enquiry; }
export async function getEnquiryActivity(id: string, organizationId: string) { const s = await createClient(); const r = await s.from("activity_logs").select("id,summary,created_at").eq("organization_id", organizationId).eq("entity_type", "enquiry").eq("entity_id", id).order("created_at", { ascending: false }).limit(20); if (r.error) throw new Error("Unable to load enquiry activity."); return (r.data ?? []) as EnquiryActivity[]; }
export async function searchActiveCustomers(organizationId: string, query = "") { const s = await createClient(); let r = s.from("customers").select("id,first_name,last_name,email,phone").eq("organization_id", organizationId).eq("status", "active").order("last_name").limit(20); if (query) { const safe = query.trim().replace(/[,%()]/g, " ").slice(0, 100); r = r.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`); } const result = await r; if (result.error) throw new Error("Unable to load customers."); return result.data ?? []; }
export async function requireEnquiryOfficeContext() { return requireOfficeContext(); }

import "server-only";

import { notFound } from "next/navigation";
import { getViewerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_PAGE_SIZE } from "./query";
import type { Customer, CustomerActivity, CustomerStatus } from "./types";

const customerColumns = [
  "id", "organization_id", "first_name", "last_name", "email", "phone",
  "address_line_1", "address_line_2", "suburb", "city", "postcode", "notes",
  "status", "archived_at", "created_at", "updated_at",
].join(",");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireOfficeContext() {
  const viewer = await getViewerContext();
  if (!viewer?.organization || viewer.organization.role === "technician") notFound();
  return { organization: viewer.organization, viewer };
}

export async function listCustomers({
  organizationId,
  page,
  query,
  status,
}: {
  organizationId: string;
  page: number;
  query: string;
  status: CustomerStatus;
}) {
  const supabase = await createClient();
  const from = (page - 1) * CUSTOMER_PAGE_SIZE;
  const to = from + CUSTOMER_PAGE_SIZE - 1;
  let request = supabase
    .from("customers")
    .select(customerColumns, { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("status", status)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .range(from, to);

  for (const term of query.split(" ").filter(Boolean)) {
    const pattern = `%${term}%`;
    request = request.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},suburb.ilike.${pattern},city.ilike.${pattern}`,
    );
  }

  const result = await request;
  if (result.error) throw new Error("Unable to load customers.");

  return {
    customers: (result.data ?? []) as unknown as Customer[],
    count: result.count ?? 0,
  };
}

export async function getCustomer(customerId: string, organizationId: string) {
  if (!uuidPattern.test(customerId)) notFound();
  const supabase = await createClient();
  const result = await supabase
    .from("customers")
    .select(customerColumns)
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle();

  if (result.error || !result.data) notFound();
  return result.data as unknown as Customer;
}

export async function getCustomerActivity(customerId: string, organizationId: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("activity_logs")
    .select("id, action, summary, created_at")
    .eq("organization_id", organizationId)
    .eq("entity_type", "customer")
    .eq("entity_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (result.error) throw new Error("Unable to load customer activity.");
  return (result.data ?? []) as CustomerActivity[];
}

export function isCustomerId(value: string) {
  return uuidPattern.test(value);
}

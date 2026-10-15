import "server-only";

import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { SmartInsightFacts } from "./types";

export async function getSmartInsightFacts(organizationId: string): Promise<SmartInsightFacts> {
  const supabase = await createClient();
  const result = await supabase.rpc("get_smart_insights", { p_organization_id: organizationId });
  if (result.error || !result.data?.[0]) throw new Error("Unable to load Smart Insights.");
  return result.data[0] as SmartInsightFacts;
}

export async function requireInsightsOfficeContext() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.organization) redirect("/onboarding");
  if (viewer.organization.role === "technician") redirect("/my-jobs");
  return { organization: viewer.organization, viewer };
}

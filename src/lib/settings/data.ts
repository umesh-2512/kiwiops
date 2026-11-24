import "server-only";
import { notFound, redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { BusinessSettings } from "./types";

export async function requireSettingsContext() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.organization) redirect("/onboarding");
  if (viewer.organization.role === "technician") notFound();
  return { organization: viewer.organization, viewer };
}
export async function getBusinessSettings(organizationId: string) {
  const supabase = await createClient();
  const result = await supabase.rpc("get_business_settings", {
    p_organization_id: organizationId,
  });
  if (result.error || !result.data?.[0]) {
    throw new Error("Unable to load business settings.");
  }
  return result.data[0] as BusinessSettings;
}

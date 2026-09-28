import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  email?: string;
  sub?: string;
  user_metadata?: Record<string, unknown>;
};

type Profile = {
  first_name: string;
  last_name: string;
};

export type OrganizationContext = {
  id: string;
  memberId: string;
  name: string;
  role: "owner" | "admin" | "technician";
};

export type ViewerContext = {
  email: string;
  firstName: string;
  id: string;
  initials: string;
  lastName: string;
  name: string;
  organization: OrganizationContext | null;
};

function metadataText(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function profileNames(claims: Claims) {
  const emailPrefix = claims.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return {
    firstName: metadataText(claims.user_metadata, "first_name") || emailPrefix || "KiwiOps",
    lastName: metadataText(claims.user_metadata, "last_name") || "User",
  };
}

export async function ensureProfile(
  supabase: SupabaseClient,
  claims: Claims,
): Promise<Profile> {
  if (!claims.sub) throw new Error("Authenticated user is missing a subject claim.");

  const existing = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", claims.sub)
    .maybeSingle<Profile>();

  if (existing.error) throw new Error("Unable to load the KiwiOps profile.");
  if (existing.data) return existing.data;

  const names = profileNames(claims);
  const created = await supabase
    .from("profiles")
    .insert({
      id: claims.sub,
      first_name: names.firstName,
      last_name: names.lastName,
    })
    .select("first_name, last_name")
    .single<Profile>();

  if (created.error || !created.data) throw new Error("Unable to create the KiwiOps profile.");
  return created.data;
}

export async function findFirstOrganization(
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizationContext | null> {
  const membership = await supabase
    .from("organization_members")
    .select("id, organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{
      id: string;
      organization_id: string;
      role: "owner" | "admin" | "technician";
    }>();

  if (membership.error) throw new Error("Unable to load organization membership.");
  if (!membership.data) return null;

  const organization = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", membership.data.organization_id)
    .single<{ display_name: string }>();

  if (organization.error || !organization.data) throw new Error("Unable to load the organization.");

  return {
    id: membership.data.organization_id,
    memberId: membership.data.id,
    name: organization.data.display_name,
    role: membership.data.role,
  };
}

export const getViewerContext = cache(async (): Promise<ViewerContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Claims | undefined;

  if (error || !claims?.sub) return null;

  const profile = await ensureProfile(supabase, claims);
  const organization = await findFirstOrganization(supabase, claims.sub);
  const name = `${profile.first_name} ${profile.last_name}`.trim();
  const initials = `${profile.first_name[0] ?? "K"}${profile.last_name[0] ?? "O"}`.toUpperCase();

  return {
    email: claims.email ?? "",
    firstName: profile.first_name,
    id: claims.sub,
    initials,
    lastName: profile.last_name,
    name,
    organization,
  };
});

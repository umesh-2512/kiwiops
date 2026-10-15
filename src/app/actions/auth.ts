"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureProfile,
  findFirstOrganization,
} from "@/lib/auth/context";
import { safeAppRedirect } from "@/lib/auth/redirects";
import {
  authErrorResponse,
  reportAuthFailure,
  runAuthRequest,
} from "@/lib/auth/service-errors";
import {
  type AuthActionState,
  hasFieldErrors,
  validateBusinessName,
  validateLogin,
  validateSignup,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  email?: string;
  sub?: string;
  user_metadata?: Record<string, unknown>;
};

async function requestOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) {
    const parsed = new URL(origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.origin;
  }

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Unable to determine the application origin.");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { data, fieldErrors } = validateLogin(formData);
  if (hasFieldErrors(fieldErrors)) return { fieldErrors, status: "error" };

  const request = await runAuthRequest("sign_in", async () => {
    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword(data);
    return { result, supabase };
  });
  if (request.status === "error") return request;

  const { result, supabase } = request.value;
  if (result.error || !result.data.user) {
    return authErrorResponse("sign_in", result.error);
  }

  const claims: Claims = {
    email: result.data.user.email,
    sub: result.data.user.id,
    user_metadata: result.data.user.user_metadata,
  };

  let organization;
  try {
    await ensureProfile(supabase, claims);
    organization = await findFirstOrganization(supabase, result.data.user.id);
  } catch {
    reportAuthFailure("sign_in", "profile_load_failed");
    return {
      message: "Your account is signed in, but KiwiOps could not load your profile. Please try again.",
      status: "error",
    };
  }

  if (!organization) redirect("/onboarding");
  redirect(safeAppRedirect(formData.get("next")));
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { data, fieldErrors } = validateSignup(formData);
  if (hasFieldErrors(fieldErrors)) return { fieldErrors, status: "error" };

  const request = await runAuthRequest("sign_up", async () => {
    const origin = await requestOrigin();
    const supabase = await createClient();
    const result = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { first_name: data.firstName, last_name: data.lastName },
        emailRedirectTo: new URL("/auth/confirm", origin).toString(),
      },
    });
    return { result, supabase };
  });
  if (request.status === "error") return request;

  const { result, supabase } = request.value;

  if (result.error) {
    return authErrorResponse("sign_up", result.error);
  }

  if (result.data.session && result.data.user) {
    try {
      await ensureProfile(supabase, {
        email: result.data.user.email,
        sub: result.data.user.id,
        user_metadata: result.data.user.user_metadata,
      });
    } catch {
      reportAuthFailure("sign_up", "profile_setup_failed");
      return {
        message:
          "Your account was created, but KiwiOps could not load your profile. Please sign in again.",
        status: "error",
      };
    }
    redirect("/onboarding");
  }

  return {
    message: "Check your email to confirm your account, then continue to KiwiOps.",
    status: "success",
  };
}

export async function createWorkspaceAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { data, fieldErrors } = validateBusinessName(formData);
  if (hasFieldErrors(fieldErrors)) return { fieldErrors, status: "error" };

  const supabase = await createClient();
  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims as Claims | undefined;
  if (claimsResult.error || !claims?.sub) redirect("/login");

  let existingOrganization;
  try {
    existingOrganization = await findFirstOrganization(supabase, claims.sub);
  } catch {
    return {
      message: "KiwiOps could not check your workspace access. Please try again.",
      status: "error",
    };
  }

  if (existingOrganization) redirect("/");

  try {
    const profile = await ensureProfile(supabase, claims);
    const memberDisplayName = `${profile.first_name} ${profile.last_name}`.trim();
    const result = await supabase.rpc("create_organization", {
      p_display_name: data.businessName,
      p_legal_name: data.businessName,
      p_member_display_name: memberDisplayName,
      p_slug: null,
    });

    if (result.error) {
      return {
        message: "KiwiOps could not create your workspace. Please try again.",
        status: "error",
      };
    }
  } catch {
    return {
      message: "KiwiOps could not finish workspace setup. Please try again.",
      status: "error",
    };
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) await supabase.auth.signOut();
  redirect("/login");
}

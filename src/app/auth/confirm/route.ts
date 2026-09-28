import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ensureProfile } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  email?: string;
  sub?: string;
  user_metadata?: Record<string, unknown>;
};

const allowedOtpTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "recovery",
  "signup",
]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  let verified = false;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    verified = !result.error;
  } else if (tokenHash && requestedType && allowedOtpTypes.has(requestedType)) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType,
    });
    verified = !result.error;
  }

  if (!verified) {
    return NextResponse.redirect(new URL("/login?status=confirmation-error", request.url));
  }

  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims as Claims | undefined;
  if (!claims?.sub) {
    return NextResponse.redirect(new URL("/login?status=confirmation-error", request.url));
  }

  try {
    await ensureProfile(supabase, claims);
  } catch {
    return NextResponse.redirect(new URL("/login?status=profile-error", request.url));
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}

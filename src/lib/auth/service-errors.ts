export const AUTH_UNAVAILABLE_MESSAGE =
  "Authentication is temporarily unavailable. Please try again.";

type AuthLogger = (message: string, context: Record<string, string>) => void;

type AuthErrorLike = {
  code?: string;
};

const publicMessages: Record<string, string> = {
  email_not_confirmed: "Confirm your email before signing in.",
  invalid_credentials: "Email or password is incorrect.",
  over_email_send_rate_limit:
    "Too many confirmation emails were requested. Try again later.",
  weak_password: "Choose a stronger password and try again.",
};

function safeCode(code: unknown) {
  return typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code)
    ? code
    : "unknown";
}

export function authServiceMessage(code?: string) {
  return publicMessages[safeCode(code)] ?? AUTH_UNAVAILABLE_MESSAGE;
}

export function reportAuthFailure(
  operation: string,
  category: string,
  code?: unknown,
  logger: AuthLogger = console.error,
) {
  logger("[auth] request failed", {
    category,
    code: safeCode(code),
    operation,
  });
}

export function authErrorResponse(
  operation: string,
  error: AuthErrorLike | null | undefined,
  logger?: AuthLogger,
) {
  reportAuthFailure(operation, "supabase_error", error?.code, logger);
  return {
    message: authServiceMessage(error?.code),
    status: "error" as const,
  };
}

export async function runAuthRequest<T>(
  operation: string,
  request: () => Promise<T>,
  logger?: AuthLogger,
): Promise<
  | { status: "success"; value: T }
  | { message: string; status: "error" }
> {
  try {
    return { status: "success", value: await request() };
  } catch {
    reportAuthFailure(operation, "request_exception", undefined, logger);
    return { message: AUTH_UNAVAILABLE_MESSAGE, status: "error" };
  }
}

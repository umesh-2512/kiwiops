import { describe, expect, it, vi } from "vitest";
import {
  AUTH_UNAVAILABLE_MESSAGE,
  authErrorResponse,
  authServiceMessage,
  runAuthRequest,
} from "./service-errors";

describe("authentication service errors", () => {
  it("preserves the invalid-credentials response", () => {
    expect(authServiceMessage("invalid_credentials")).toBe(
      "Email or password is incorrect.",
    );
  });

  it("tells an unconfirmed user to confirm their email", () => {
    expect(authServiceMessage("email_not_confirmed")).toBe(
      "Confirm your email before signing in.",
    );
  });

  it("keeps unexpected Supabase errors generic and logs only safe metadata", () => {
    const logger = vi.fn();
    const response = authErrorResponse(
      "sign_in",
      { code: "provider_disabled" },
      logger,
    );

    expect(response.message).toBe(AUTH_UNAVAILABLE_MESSAGE);
    expect(logger).toHaveBeenCalledWith("[auth] request failed", {
      category: "supabase_error",
      code: "provider_disabled",
      operation: "sign_in",
    });
  });

  it("catches thrown network exceptions without logging the exception", async () => {
    const logger = vi.fn();
    const secretBearingError = new Error(
      "fetch failed with password=do-not-log and token=do-not-log",
    );
    const result = await runAuthRequest(
      "sign_in",
      async () => {
        throw secretBearingError;
      },
      logger,
    );

    expect(result).toEqual({
      message: AUTH_UNAVAILABLE_MESSAGE,
      status: "error",
    });
    expect(logger).toHaveBeenCalledWith("[auth] request failed", {
      category: "request_exception",
      code: "unknown",
      operation: "sign_in",
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("do-not-log");
  });
});

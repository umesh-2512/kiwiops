import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabasePublicConfig,
  SupabasePublicConfigError,
} from "./config";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined)
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
});

describe("Supabase public configuration", () => {
  it("accepts a valid URL and publishable key without exposing their values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_fictional_test_value";

    expect(getSupabasePublicConfig()).toEqual({
      publishableKey: "sb_publishable_fictional_test_value",
      url: "https://example.supabase.co",
    });
  });

  it.each([
    [undefined, "sb_publishable_fictional_test_value"],
    ["not-a-url", "sb_publishable_fictional_test_value"],
    ["ftp://example.supabase.co", "sb_publishable_fictional_test_value"],
    ["https://example.supabase.co", undefined],
    ["https://example.supabase.co", "short"],
    ["https://example.supabase.co", "invalid key containing spaces"],
  ])("rejects missing or malformed configuration", (url, key) => {
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;

    expect(() => getSupabasePublicConfig()).toThrow(SupabasePublicConfigError);
  });
});

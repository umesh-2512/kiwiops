type SupabasePublicConfig = {
  publishableKey: string;
  url: string;
};

export class SupabasePublicConfigError extends Error {
  constructor() {
    super("Supabase public configuration is missing or invalid.");
    this.name = "SupabasePublicConfigError";
  }
}

function validSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validPublishableKey(value: string) {
  return value.length >= 20 && !/\s/.test(value);
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (
    !url ||
    !publishableKey ||
    !validSupabaseUrl(url) ||
    !validPublishableKey(publishableKey)
  ) {
    throw new SupabasePublicConfigError();
  }

  return { publishableKey, url };
}

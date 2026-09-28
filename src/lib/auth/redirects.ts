const appPaths = new Set([
  "/",
  "/customers",
  "/enquiries",
  "/quotes",
  "/jobs",
  "/invoices",
  "/team",
  "/reports",
  "/settings",
]);

export function safeAppRedirect(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;

  try {
    const decoded = decodeURIComponent(value);
    return appPaths.has(decoded) ? decoded : fallback;
  } catch {
    return fallback;
  }
}

export function isPublicAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/");
}

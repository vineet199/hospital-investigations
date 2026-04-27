/**
 * Normalize user-provided Supabase URLs to the project origin expected by
 * supabase-js. This keeps both browser and Node scripts safe when someone
 * pastes a Dashboard URL or a `/rest/v1` endpoint instead of the project URL.
 */
export function normalizeSupabaseUrl(rawUrl?: string) {
  if (!rawUrl) return undefined;

  const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, "");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.hostname === "supabase.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const projectIndex = parts.indexOf("project");
    const projectRef = projectIndex >= 0 ? parts[projectIndex + 1] : undefined;
    if (projectRef) return `https://${projectRef}.supabase.co`;
  }

  return url.origin;
}

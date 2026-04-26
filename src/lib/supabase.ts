import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function normalizeSupabaseUrl(rawUrl?: string) {
  if (!rawUrl) return undefined;

  const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, "");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  // If a dashboard URL was pasted, derive the API project URL from the ref.
  // Example: https://supabase.com/dashboard/project/abcdefghijklmnopqrst/settings/api
  if (url.hostname === "supabase.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const projectIndex = parts.indexOf("project");
    const projectRef = projectIndex >= 0 ? parts[projectIndex + 1] : undefined;
    if (projectRef) return `https://${projectRef}.supabase.co`;
  }

  // Supabase clients expect only the project origin. Strip accidental paths
  // like /rest/v1 or /auth/v1 so auth calls do not become /rest/v1/auth/v1.
  return url.origin;
}

let supabaseUrl: string | undefined;
try {
  supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
} catch (error) {
  console.error(
    "Invalid VITE_SUPABASE_URL. Use your project URL, e.g. https://your-project-ref.supabase.co",
    error,
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

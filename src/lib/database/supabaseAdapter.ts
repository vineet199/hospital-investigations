import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AuthUserIdentity, DatabaseAdapter, SelectOptions } from "./types";

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

function applySelectOptions(query: any, options: SelectOptions = {}) {
  let next = query;
  for (const [column, value] of Object.entries(options.eq ?? {})) {
    next = next.eq(column, value);
  }
  if (options.order) {
    next = next.order(options.order.column, { ascending: options.order.ascending ?? true });
  }
  if (options.limit !== undefined) {
    next = next.limit(options.limit);
  }
  return next;
}

function toAuthIdentity(user: { id: string; email?: string | null }): AuthUserIdentity {
  return { id: user.id, email: user.email ?? null };
}

export const supabaseDatabaseAdapter: DatabaseAdapter = {
  provider: "supabase",
  isConfigured: isSupabaseConfigured,

  async getCurrentUser() {
    const client = requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.user ? toAuthIdentity(data.session.user) : null;
  },

  async signInWithPassword(email, password) {
    const client = requireClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Authentication provider did not return a user.");
    return toAuthIdentity(data.user);
  },

  async signOut() {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async selectRows<T>(table: string, options: SelectOptions = {}) {
    const client = requireClient();
    const query = client.from(table).select(options.select ?? "*");
    const { data, error } = await applySelectOptions(query, options);
    if (error) throw error;
    return (data ?? []) as T[];
  },

  async selectMaybeSingle<T>(table: string, options: SelectOptions = {}) {
    const client = requireClient();
    const query = client.from(table).select(options.select ?? "*");
    const { data, error } = await applySelectOptions(query, { ...options, limit: 1 }).maybeSingle();
    if (error) throw error;
    return (data ?? null) as T | null;
  },

  async callFunction<T>(name: string, args: Record<string, unknown> = {}) {
    const client = requireClient();
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data as T;
  },
};

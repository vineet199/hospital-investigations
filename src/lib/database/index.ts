import { supabaseDatabaseAdapter } from "./supabaseAdapter";
import type { DatabaseAdapter } from "./types";

function unsupportedAdapter(provider: string): DatabaseAdapter {
  const error = () =>
    new Error(
      `Database provider "${provider}" is not implemented in this build. Implement src/lib/database/types.ts and wire it in src/lib/database/index.ts.`,
    );

  return {
    provider,
    isConfigured: false,
    async getCurrentUser() {
      throw error();
    },
    async signInWithPassword() {
      throw error();
    },
    async signOut() {
      throw error();
    },
    async selectRows() {
      throw error();
    },
    async selectMaybeSingle() {
      throw error();
    },
    async callFunction() {
      throw error();
    },
  };
}

const provider = (import.meta.env.VITE_DATABASE_PROVIDER as string | undefined)?.trim().toLowerCase() || "supabase";

export const databaseAdapter: DatabaseAdapter =
  provider === "supabase" ? supabaseDatabaseAdapter : unsupportedAdapter(provider);

export type { AuthUserIdentity, DatabaseAdapter, SelectOptions } from "./types";

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export interface SelectOptions {
  select?: string;
  eq?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

export interface DatabaseAdapter {
  readonly provider: string;
  readonly isConfigured: boolean;
  getCurrentUser(): Promise<AuthUserIdentity | null>;
  signInWithPassword(email: string, password: string): Promise<AuthUserIdentity>;
  signOut(): Promise<void>;
  selectRows<T = Record<string, unknown>>(table: string, options?: SelectOptions): Promise<T[]>;
  selectMaybeSingle<T = Record<string, unknown>>(table: string, options?: SelectOptions): Promise<T | null>;
  callFunction<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>;
}

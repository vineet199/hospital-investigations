import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Activity, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppState, AppUser, Investigation, Status, Tenant, UserRole } from "./types";

type Action =
  | { type: "SET_CURRENT_DOCTOR"; payload: string }
  | { type: "ADD_INVESTIGATIONS"; payload: Omit<Investigation, "id" | "timeline" | "status">[] }
  | { type: "SEND_TO_DEPARTMENT"; payload: { id: string; actor?: string; technician?: string } }
  | { type: "ADVANCE_STATUS"; payload: { id: string; status: Status; actor?: string } }
  | { type: "ADD_RESULT_NOTES"; payload: { id: string; notes: string; actor?: string } }
  | { type: "MARK_REVIEWED"; payload: { id: string; actor?: string } };

type Permission = "createOrders" | "dispatchOrders" | "reviewResults" | "workDepartment" | "admin";

interface AppContextType {
  state: AppState;
  user: AppUser;
  tenant: Tenant;
  isLoading: boolean;
  dispatch: (action: Action) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission, departmentId?: string) => boolean;
}

const TENANT_STORAGE_KEY = "hospital-investigations-tenant-slug";

const emptyState: AppState = {
  patients: {},
  doctors: {},
  departments: {},
  investigations: {},
  currentDoctorId: "",
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function getClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
  }
  return supabase;
}

function getErrorMessage(error: unknown, fallback = "Supabase request failed.") {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function getStoredTenantSlug() {
  try {
    return window.localStorage.getItem(TENANT_STORAGE_KEY) ?? "city-general";
  } catch {
    return "city-general";
  }
}

function storeTenantSlug(slug: string | null) {
  try {
    if (slug) window.localStorage.setItem(TENANT_STORAGE_KEY, slug);
    else window.localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // localStorage is a convenience only; the Supabase session remains authoritative.
  }
}

function recordFrom<T extends { id: string }, V>(rows: T[], map: (row: T) => V): Record<string, V> {
  return Object.fromEntries(rows.map((row) => [row.id, map(row)]));
}

function assertSupabaseResult(result: { error: unknown }) {
  if (result.error) throw new Error(getErrorMessage(result.error));
}

function tenantFromEmbedded(row: any): Tenant {
  const rawTenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  if (!rawTenant) throw new Error("Your hospital membership is missing tenant details.");
  return {
    id: rawTenant.id,
    slug: rawTenant.slug,
    name: rawTenant.name,
    logoUrl: rawTenant.logo_url ?? undefined,
  };
}

async function claimMembershipByEmail(email?: string | null) {
  if (!email) return;
  const client = getClient();
  // This safely links seeded membership rows to the signed-in Supabase Auth user.
  // It only succeeds when the requested email matches the authenticated JWT email.
  const result = await client.rpc("claim_membership_by_email", { p_email: email });
  assertSupabaseResult(result);
}

async function loadMembership(userId: string, preferredTenantSlug?: string | null, email?: string | null) {
  await claimMembershipByEmail(email);

  const client = getClient();
  const result = await client
    .from("tenant_memberships")
    .select(
      "tenant_id,email,display_name,role,department_id,doctor_id,created_at,tenants!inner(id,slug,name,logo_url)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  assertSupabaseResult(result);
  const memberships = ((result.data ?? []) as any[]).filter(Boolean);
  if (memberships.length === 0) {
    throw new Error("No hospital membership found for this account. Create or link a tenant_memberships row first.");
  }

  const selected =
    memberships.find((row) => tenantFromEmbedded(row).slug === preferredTenantSlug) ?? memberships[0];
  const tenant = tenantFromEmbedded(selected);

  if (preferredTenantSlug && tenant.slug !== preferredTenantSlug) {
    throw new Error(`This account is not a member of the selected hospital (${preferredTenantSlug}).`);
  }

  const appUser: AppUser = {
    id: userId,
    tenantId: selected.tenant_id,
    email: selected.email ?? email ?? "",
    name: selected.display_name,
    role: selected.role as UserRole,
    departmentId: selected.department_id ?? undefined,
    doctorId: selected.doctor_id ?? undefined,
  };

  return { tenant, user: appUser };
}

async function fetchAppState(tenantId: string, user?: AppUser | null): Promise<AppState> {
  const client = getClient();
  const [departmentsResult, doctorsResult, patientsResult, investigationsResult, eventsResult] = await Promise.all([
    client.from("departments").select("id,name").eq("tenant_id", tenantId).order("name"),
    client.from("doctors").select("id,name,department").eq("tenant_id", tenantId).order("name"),
    client.from("patients").select("id,mrn,name,age,gender,ward,bed").eq("tenant_id", tenantId).order("name"),
    client
      .from("investigations")
      .select("id,patient_id,ordered_by_doctor_id,type,notes,priority,department_id,technician,status,result_notes,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    client
      .from("timeline_events")
      .select("investigation_id,stage,timestamp,actor")
      .eq("tenant_id", tenantId)
      .order("timestamp", { ascending: true }),
  ]);

  for (const result of [departmentsResult, doctorsResult, patientsResult, investigationsResult, eventsResult]) {
    assertSupabaseResult(result);
  }

  const departments = (departmentsResult.data ?? []) as any[];
  const doctors = (doctorsResult.data ?? []) as any[];
  const patients = (patientsResult.data ?? []) as any[];
  const investigations = (investigationsResult.data ?? []) as any[];
  const events = (eventsResult.data ?? []) as any[];

  const timelineByInvestigation = new Map<string, { stage: Status; timestamp: string; actor: string }[]>();
  for (const event of events) {
    const timeline = timelineByInvestigation.get(event.investigation_id) ?? [];
    timeline.push({ stage: event.stage as Status, timestamp: event.timestamp, actor: event.actor });
    timelineByInvestigation.set(event.investigation_id, timeline);
  }

  const doctorRecords = recordFrom(doctors, (d) => ({ id: d.id, name: d.name, department: d.department }));

  return {
    patients: recordFrom(patients, (p) => ({
      id: p.id,
      mrn: p.mrn ?? undefined,
      name: p.name,
      age: Number(p.age),
      gender: p.gender,
      ward: p.ward,
      bed: p.bed,
    })),
    doctors: doctorRecords,
    departments: recordFrom(departments, (d) => ({ id: d.id, name: d.name })),
    investigations: recordFrom(investigations, (i) => ({
      id: i.id,
      patientId: i.patient_id,
      orderedByDoctorId: i.ordered_by_doctor_id,
      type: i.type,
      notes: i.notes ?? "",
      priority: i.priority,
      departmentId: i.department_id,
      technician: i.technician ?? undefined,
      status: i.status,
      resultNotes: i.result_notes ?? undefined,
      timeline: timelineByInvestigation.get(i.id) ?? [
        {
          stage: i.status as Status,
          timestamp: i.created_at,
          actor: "System",
        },
      ],
    })),
    currentDoctorId: user?.doctorId ?? Object.keys(doctorRecords)[0] ?? "",
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [user, setUser] = useState<AppUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const clearAuth = useCallback(() => {
    setUser(null);
    setTenant(null);
    setState(emptyState);
  }, []);

  const loadWorkspace = useCallback(async (authUserId: string, email?: string | null, preferredSlug?: string | null) => {
    const membership = await loadMembership(authUserId, preferredSlug ?? getStoredTenantSlug(), email);
    const nextState = await fetchAppState(membership.tenant.id, membership.user);
    setTenant(membership.tenant);
    setUser(membership.user);
    setState(nextState);
    storeTenantSlug(membership.tenant.slug);
    return membership;
  }, []);

  const refresh = useCallback(async () => {
    if (!tenant || !user) return;
    const nextState = await fetchAppState(tenant.id, user);
    setState((previous) => ({ ...nextState, currentDoctorId: previous.currentDoctorId || nextState.currentDoctorId }));
  }, [tenant, user]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!isSupabaseConfigured) {
        setAuthLoading(false);
        return;
      }

      try {
        const client = getClient();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        const authUser = data.session?.user;
        if (!authUser) {
          if (!cancelled) clearAuth();
          return;
        }
        if (!cancelled) await loadWorkspace(authUser.id, authUser.email, getStoredTenantSlug());
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          await supabase?.auth.signOut().catch(() => undefined);
          clearAuth();
          toast.error(error instanceof Error ? error.message : "Unable to restore Supabase session.");
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [clearAuth, loadWorkspace]);

  const login = useCallback(
    async (email: string, password: string, tenantSlug: string) => {
      setIsLoading(true);
      try {
        const client = getClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Supabase did not return an authenticated user.");
        const membership = await loadWorkspace(data.user.id, data.user.email, tenantSlug);
        toast.success(`Signed in to ${membership.tenant.name} as ${membership.user.name}`);
      } catch (error) {
        await supabase?.auth.signOut().catch(() => undefined);
        clearAuth();
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [clearAuth, loadWorkspace],
  );

  const logout = useCallback(async () => {
    await supabase?.auth.signOut().catch(() => undefined);
    clearAuth();
    toast.success("Signed out.");
  }, [clearAuth]);

  const can = useCallback(
    (permission: Permission, departmentId?: string) => {
      if (!user) return false;
      if (user.role === "Admin") return true;

      switch (permission) {
        case "createOrders":
          return user.role === "Doctor";
        case "dispatchOrders":
          return user.role === "Doctor" || user.role === "Nurse";
        case "reviewResults":
          return user.role === "Doctor";
        case "workDepartment":
          return (
            (user.role === "Technician" || user.role === "Department Head") &&
            !!departmentId &&
            user.departmentId === departmentId
          );
        case "admin":
          return false;
        default:
          return false;
      }
    },
    [user],
  );

  const dispatch = useCallback(
    async (action: Action) => {
      if (action.type === "SET_CURRENT_DOCTOR") {
        setState((previous) => ({ ...previous, currentDoctorId: action.payload }));
        return;
      }

      if (!tenant || !user) {
        const error = new Error("Please sign in first.");
        toast.error(error.message);
        throw error;
      }

      const client = getClient();
      setIsLoading(true);
      try {
        let result: { error: unknown };
        switch (action.type) {
          case "ADD_INVESTIGATIONS":
            result = await client.rpc("create_investigations", {
              p_tenant_id: tenant.id,
              p_investigations: action.payload,
            });
            break;
          case "SEND_TO_DEPARTMENT":
            result = await client.rpc("send_to_department", {
              p_tenant_id: tenant.id,
              p_investigation_id: action.payload.id,
              p_technician: action.payload.technician ?? null,
            });
            break;
          case "ADVANCE_STATUS":
            result = await client.rpc("advance_investigation", {
              p_tenant_id: tenant.id,
              p_investigation_id: action.payload.id,
              p_status: action.payload.status,
            });
            break;
          case "ADD_RESULT_NOTES":
            result = await client.rpc("save_result", {
              p_tenant_id: tenant.id,
              p_investigation_id: action.payload.id,
              p_notes: action.payload.notes,
            });
            break;
          case "MARK_REVIEWED":
            result = await client.rpc("mark_reviewed", {
              p_tenant_id: tenant.id,
              p_investigation_id: action.payload.id,
            });
            break;
          default:
            return;
        }
        assertSupabaseResult(result);
        const nextState = await fetchAppState(tenant.id, user);
        setState((previous) => ({ ...nextState, currentDoctorId: previous.currentDoctorId || nextState.currentDoctorId }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update investigation workflow.");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [tenant, user],
  );

  const context = useMemo<AppContextType | undefined>(() => {
    if (!user || !tenant) return undefined;
    return { state, user, tenant, isLoading, dispatch, refresh, logout, can };
  }, [can, dispatch, isLoading, logout, refresh, state, tenant, user]);

  if (authLoading) {
    return <FullPageMessage title="Loading secure hospital workspace…" />;
  }

  if (!user || !tenant || !context) {
    return <LoginScreen login={login} isLoading={isLoading} />;
  }

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

function FullPageMessage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Activity className="h-5 w-5 text-primary animate-pulse" />
        <span className="text-sm font-medium">{title}</span>
      </div>
    </div>
  );
}

function SetupRequiredScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle>Connect Supabase to continue</CardTitle>
          <CardDescription>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to a local <code>.env</code> file,
            then apply the migration in <code>supabase/migrations</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>See <code>SUPABASE_SETUP.md</code> for the full multi-tenant setup and demo user instructions.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginScreen({
  login,
  isLoading,
}: {
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  isLoading: boolean;
}) {
  const [tenantSlug, setTenantSlug] = useState(getStoredTenantSlug());
  const [email, setEmail] = useState("doctor@city-general.demo");
  const [password, setPassword] = useState("demo123");

  if (!isSupabaseConfigured) return <SetupRequiredScreen />;

  const tenantOptions = [
    { slug: "city-general", name: "City General Hospital" },
    { slug: "sunrise-medical", name: "Sunrise Medical Center" },
  ];

  const demoUsers = [
    { label: "City Doctor", tenantSlug: "city-general", email: "doctor@city-general.demo" },
    { label: "City Nurse", tenantSlug: "city-general", email: "nurse@city-general.demo" },
    { label: "City Pathology Tech", tenantSlug: "city-general", email: "lab@city-general.demo" },
    { label: "City Radiology Tech", tenantSlug: "city-general", email: "radiology@city-general.demo" },
    { label: "City Admin", tenantSlug: "city-general", email: "admin@city-general.demo" },
    { label: "Sunrise Doctor", tenantSlug: "sunrise-medical", email: "doctor@sunrise.demo" },
    { label: "Sunrise Nurse", tenantSlug: "sunrise-medical", email: "nurse@sunrise.demo" },
    { label: "Sunrise Lab Tech", tenantSlug: "sunrise-medical", email: "lab@sunrise.demo" },
    { label: "Sunrise Admin", tenantSlug: "sunrise-medical", email: "admin@sunrise.demo" },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password, tenantSlug);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Activity className="h-6 w-6" />
          </div>
          <CardTitle>Hospital Investigation System</CardTitle>
          <CardDescription>
            Multi-tenant Supabase workspace. Demo password: <strong>demo123</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <Label>Hospital</Label>
              <Select
                value={tenantSlug}
                onValueChange={(slug) => {
                  setTenantSlug(slug);
                  const doctor = demoUsers.find((demo) => demo.tenantSlug === slug && demo.label.includes("Doctor"));
                  if (doctor) setEmail(doctor.email);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hospital" />
                </SelectTrigger>
                <SelectContent>
                  {tenantOptions.map((tenant) => (
                    <SelectItem key={tenant.slug} value={tenant.slug}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 border-t pt-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Quick demo roles</div>
            <div className="grid grid-cols-1 gap-2">
              {demoUsers.map((demo) => (
                <Button
                  key={`${demo.tenantSlug}:${demo.email}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-between"
                  onClick={() => {
                    setTenantSlug(demo.tenantSlug);
                    setEmail(demo.email);
                    setPassword("demo123");
                  }}
                >
                  <span>{demo.label}</span>
                  <span className="text-muted-foreground text-xs">{demo.email}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppStore must be used within an authenticated AppProvider");
  }
  return context;
}

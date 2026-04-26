import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Activity } from "lucide-react";
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
import type { AppState, AppUser, Investigation, Status } from "./types";

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
  isLoading: boolean;
  dispatch: (action: Action) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission, departmentId?: string) => boolean;
}

interface ApiStateResponse {
  state: AppState;
}

interface AuthResponse extends ApiStateResponse {
  token: string;
  user: AppUser;
}

const STORAGE_KEY = "hospital-investigations-token";

const emptyState: AppState = {
  patients: {},
  doctors: {},
  departments: {},
  investigations: {},
  currentDoctorId: "D-101",
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function getStoredToken() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The current in-memory session can still continue if localStorage is unavailable.
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data as T;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const applyAuth = useCallback((auth: AuthResponse) => {
    setToken(auth.token);
    storeToken(auth.token);
    setUser(auth.user);
    setState(auth.state);
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    storeToken(null);
    setUser(null);
    setState(emptyState);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const data = await apiRequest<ApiStateResponse>("/api/state", { method: "GET" }, token);
    setState(data.state);
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const data = await apiRequest<{ user: AppUser; state: AppState }>(
          "/api/auth/me",
          { method: "GET" },
          token,
        );
        if (!cancelled) {
          setUser(data.user);
          setState(data.state);
        }
      } catch {
        if (!cancelled) clearAuth();
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [clearAuth, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const auth = await apiRequest<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        applyAuth(auth);
        toast.success(`Signed in as ${auth.user.name}`);
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    if (token) {
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" }, token).catch(() => undefined);
    }
    clearAuth();
    toast.success("Signed out.");
  }, [clearAuth, token]);

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

      if (!token || !user) {
        const error = new Error("Please sign in first.");
        toast.error(error.message);
        throw error;
      }

      setIsLoading(true);
      try {
        let data: ApiStateResponse;
        switch (action.type) {
          case "ADD_INVESTIGATIONS":
            data = await apiRequest<ApiStateResponse>(
              "/api/investigations",
              { method: "POST", body: JSON.stringify({ investigations: action.payload }) },
              token,
            );
            break;
          case "SEND_TO_DEPARTMENT":
            data = await apiRequest<ApiStateResponse>(
              `/api/investigations/${encodeURIComponent(action.payload.id)}/send-to-department`,
              { method: "POST", body: JSON.stringify({ technician: action.payload.technician }) },
              token,
            );
            break;
          case "ADVANCE_STATUS":
            data = await apiRequest<ApiStateResponse>(
              `/api/investigations/${encodeURIComponent(action.payload.id)}/advance`,
              { method: "POST", body: JSON.stringify({ status: action.payload.status }) },
              token,
            );
            break;
          case "ADD_RESULT_NOTES":
            data = await apiRequest<ApiStateResponse>(
              `/api/investigations/${encodeURIComponent(action.payload.id)}/result`,
              { method: "POST", body: JSON.stringify({ notes: action.payload.notes }) },
              token,
            );
            break;
          case "MARK_REVIEWED":
            data = await apiRequest<ApiStateResponse>(
              `/api/investigations/${encodeURIComponent(action.payload.id)}/review`,
              { method: "POST", body: "{}" },
              token,
            );
            break;
          default:
            return;
        }
        setState(data.state);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update investigation workflow.");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [token, user],
  );

  const context = useMemo<AppContextType | undefined>(() => {
    if (!user) return undefined;
    return { state, user, isLoading, dispatch, refresh, logout, can };
  }, [can, dispatch, isLoading, logout, refresh, state, user]);

  if (authLoading) {
    return <FullPageMessage title="Loading secure hospital workspace…" />;
  }

  if (!user || !context) {
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

function LoginScreen({
  login,
  isLoading,
}: {
  login: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState("doctor@hospital.local");
  const [password, setPassword] = useState("demo123");

  const demoUsers = [
    { label: "Doctor", email: "doctor@hospital.local" },
    { label: "Pathology Tech", email: "lab@hospital.local" },
    { label: "Radiology Tech", email: "radiology@hospital.local" },
    { label: "Nurse", email: "nurse@hospital.local" },
    { label: "Admin", email: "admin@hospital.local" },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password);
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
            Sign in to access the database-backed MVP workflow. Demo password: <strong>demo123</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
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
                  key={demo.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-between"
                  onClick={() => {
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

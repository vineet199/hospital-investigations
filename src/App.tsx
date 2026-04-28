import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppProvider } from "@/store/AppStore";
import { AppLayout } from "@/components/AppLayout";
import { Spinner } from "@/components/ui/spinner";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Patients = lazy(() => import("@/pages/Patients"));
const PatientDetail = lazy(() => import("@/pages/PatientDetail"));
const Departments = lazy(() => import("@/pages/Departments"));
const DepartmentDetail = lazy(() => import("@/pages/DepartmentDetail"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const AdminSuite = lazy(() => import("@/pages/AdminSuite"));

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<RouteLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/patients" component={Patients} />
          <Route path="/patients/:id" component={PatientDetail} />
          <Route path="/departments" component={Departments} />
          <Route path="/departments/:id" component={DepartmentDetail} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/admin" component={AdminSuite} />
          <Route path="/billing" component={AdminSuite} />
          <Route path="/pharmacy" component={AdminSuite} />
          <Route path="/reports" component={AdminSuite} />
          <Route path="/audit" component={AdminSuite} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function RouteLoader() {
  return (
    <div className="min-h-[360px] flex items-center justify-center text-muted-foreground">
      <div className="flex items-center gap-2 text-sm">
        <Spinner />
        Loading workspace…
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </AppProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

export default App;

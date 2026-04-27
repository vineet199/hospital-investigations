import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppProvider } from "@/store/AppStore";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import PatientDetail from "@/pages/PatientDetail";
import Departments from "@/pages/Departments";
import DepartmentDetail from "@/pages/DepartmentDetail";
import HistoryPage from "@/pages/HistoryPage";
import AdminSuite from "@/pages/AdminSuite";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
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
    </AppLayout>
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

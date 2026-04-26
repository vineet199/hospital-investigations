import React from "react";
import { Link, useLocation } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { LayoutDashboard, Users, Building2, History, Activity, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { state, user, tenant, dispatch, logout } = useAppStore();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Patients", href: "/patients", icon: Users },
    { name: "Departments", href: "/departments", icon: Building2 },
    { name: "History", href: "/history", icon: History },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r">
          <SidebarHeader className="p-4 flex flex-row items-center gap-2 border-b h-14">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-primary block leading-tight">HIMS</span>
              <span className="text-[10px] text-muted-foreground truncate block max-w-[150px]">
                {tenant.name}
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2 gap-1">
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href || (item.href !== "/" && location.startsWith(item.href))}
                  >
                    <Link href={item.href} className="flex items-center gap-2 w-full px-2 py-1.5">
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
            <h1 className="text-lg font-medium text-foreground">
              {navigation.find((item) => location === item.href || (item.href !== "/" && location.startsWith(item.href)))?.name || "Dashboard"}
            </h1>
            
            <div className="flex items-center gap-3">
              {(user.role === "Admin" || user.role === "Doctor") && (
                <>
                  <span className="text-sm text-muted-foreground font-medium">Ordering as:</span>
                  <Select
                    value={state.currentDoctorId}
                    disabled={user.role !== "Admin"}
                    onValueChange={(val) => dispatch({ type: "SET_CURRENT_DOCTOR", payload: val })}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-sm bg-muted/50 border-border">
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(state.doctors).map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.name} ({doc.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <div className="hidden md:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {tenant.slug} · {user.role}{user.departmentId ? ` · ${state.departments[user.departmentId]?.name ?? user.departmentId}` : ""}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

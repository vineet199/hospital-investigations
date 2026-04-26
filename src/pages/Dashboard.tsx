import { useMemo } from "react";
import { Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { StatusStepper } from "@/components/StatusStepper";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUS_ORDER, timeAgo, fullTime } from "@/lib/format";
import { Activity, AlertTriangle, FlaskConical, CheckCircle2 } from "lucide-react";
import type { Investigation, Status } from "@/store/types";

export default function Dashboard() {
  const { state } = useAppStore();
  const investigations = Object.values(state.investigations);

  const kpis = useMemo(() => {
    const total = investigations.length;
    const active = investigations.filter((i) => i.status !== "Reviewed by Doctor").length;
    const resultReady = investigations.filter((i) => i.status === "Result Ready").length;
    const stat = investigations.filter(
      (i) => i.priority === "Stat" && i.status !== "Reviewed by Doctor",
    ).length;
    return { total, active, resultReady, stat };
  }, [investigations]);

  const grouped = useMemo(() => {
    const map = new Map<Status, Investigation[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const inv of investigations) {
      map.get(inv.status)!.push(inv);
    }
    return map;
  }, [investigations]);

  const recentActivity = useMemo(() => {
    const events = investigations.flatMap((inv) =>
      inv.timeline.map((e) => ({
        ...e,
        investigationId: inv.id,
        type: inv.type,
        patientId: inv.patientId,
      })),
    );
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [investigations]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Operations Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Live status of all investigations across the hospital.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Active Investigations"
          value={kpis.active}
          tone="primary"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Stat Priority Pending"
          value={kpis.stat}
          tone="danger"
        />
        <KpiCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Results Awaiting Review"
          value={kpis.resultReady}
          tone="amber"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Total Tracked"
          value={kpis.total}
          tone="muted"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Real-Time Tracker</CardTitle>
            <CardDescription>Investigations grouped by current stage.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {STATUS_ORDER.map((stage) => {
              const items = grouped.get(stage) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={stage} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={stage} />
                    <span className="text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? "investigation" : "investigations"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((inv) => {
                      const patient = state.patients[inv.patientId];
                      const dept = state.departments[inv.departmentId];
                      return (
                        <Link
                          key={inv.id}
                          href={`/patients/${inv.patientId}`}
                          className="block border rounded-lg p-3 hover-elevate bg-card"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{inv.type}</span>
                                <PriorityBadge priority={inv.priority} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {patient?.name} · {patient?.ward} {patient?.bed} · {dept?.name}
                              </div>
                            </div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {timeAgo(inv.timeline[inv.timeline.length - 1]!.timestamp)}
                            </div>
                          </div>
                          <StatusStepper investigation={inv} compact />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest events across all patients.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              <ol className="flex flex-col">
                {recentActivity.map((e, i) => {
                  const patient = state.patients[e.patientId];
                  return (
                    <li
                      key={i}
                      className="flex gap-3 px-6 py-3 border-b last:border-b-0"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        {i < recentActivity.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium">{e.stage}</span>
                          <span className="text-muted-foreground"> · {e.type}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {patient?.name} · by {e.actor}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {fullTime(e.timestamp)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "danger" | "amber" | "muted";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    danger: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    muted: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

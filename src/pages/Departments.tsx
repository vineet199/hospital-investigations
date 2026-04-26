import { useMemo } from "react";
import { Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pill,
  Bone,
  TestTubes,
  ScanLine,
  Droplet,
  HeartPulse,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const DEPT_ICON: Record<string, LucideIcon> = {
  "DEP-1": Pill,
  "DEP-2": Bone,
  "DEP-3": TestTubes,
  "DEP-4": ScanLine,
  "DEP-5": Droplet,
  "DEP-6": HeartPulse,
};

export default function Departments() {
  const { state } = useAppStore();
  const departments = Object.values(state.departments);

  const counts = useMemo(() => {
    const map = new Map<string, { pending: number; inProgress: number; ready: number }>();
    for (const d of departments) map.set(d.id, { pending: 0, inProgress: 0, ready: 0 });
    for (const inv of Object.values(state.investigations)) {
      const c = map.get(inv.departmentId);
      if (!c) continue;
      if (inv.status === "Sent to Department") c.pending += 1;
      else if (inv.status === "In Progress") c.inProgress += 1;
      else if (inv.status === "Result Ready") c.ready += 1;
    }
    return map;
  }, [state.investigations, departments]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Departments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Each department processes the investigations routed to it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((d) => {
          const Icon = DEPT_ICON[d.id] ?? TestTubes;
          const c = counts.get(d.id)!;
          const total = c.pending + c.inProgress + c.ready;
          return (
            <Link key={d.id} href={`/departments/${d.id}`}>
              <Card className="hover-elevate cursor-pointer h-full">
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {total} {total === 1 ? "open investigation" : "open investigations"}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <Stat label="Queued" value={c.pending} />
                    <Stat label="In Progress" value={c.inProgress} />
                    <Stat label="Ready" value={c.ready} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-lg font-semibold tabular-nums leading-tight">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

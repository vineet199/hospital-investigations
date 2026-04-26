import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { fullTime } from "@/lib/format";

export default function HistoryPage() {
  const { state } = useAppStore();
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const events = useMemo(() => {
    const all = Object.values(state.investigations).flatMap((inv) =>
      inv.timeline.map((e) => ({
        ...e,
        investigationId: inv.id,
        investigationType: inv.type,
        patientId: inv.patientId,
        departmentId: inv.departmentId,
        priority: inv.priority,
      })),
    );
    return all
      .filter((e) => patientFilter === "all" || e.patientId === patientFilter)
      .filter((e) => deptFilter === "all" || e.departmentId === deptFilter)
      .filter((e) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const patient = state.patients[e.patientId];
        return (
          e.investigationType.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q) ||
          patient?.name.toLowerCase().includes(q) ||
          patient?.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state, patientFilter, deptFilter, query]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">History & Audit Log</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Every event across every investigation, in reverse chronological order.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient, test, or actor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={patientFilter} onValueChange={setPatientFilter}>
            <SelectTrigger><SelectValue placeholder="All patients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All patients</SelectItem>
              {Object.values(state.patients).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {Object.values(state.departments).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{events.length} events</CardTitle>
          <CardDescription>
            Showing all matching events. Click a patient name to jump to their profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">
              No events match your filters.
            </div>
          ) : (
            <ol className="flex flex-col">
              {events.map((e, i) => {
                const patient = state.patients[e.patientId];
                const dept = state.departments[e.departmentId];
                return (
                  <li
                    key={i}
                    className="grid grid-cols-12 gap-3 px-6 py-3 border-b last:border-b-0 items-start"
                  >
                    <div className="col-span-12 md:col-span-3 text-xs text-muted-foreground tabular-nums">
                      {fullTime(e.timestamp)}
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <Badge variant="outline" className="text-[10px]">
                        {e.stage}
                      </Badge>
                    </div>
                    <div className="col-span-12 md:col-span-7 text-sm">
                      <span className="font-medium">{e.investigationType}</span>{" "}
                      <span className="text-muted-foreground">at {dept?.name}</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <Link
                          href={`/patients/${e.patientId}`}
                          className="text-primary hover:underline"
                        >
                          {patient?.name}
                        </Link>
                        {" "}({patient?.id}) · by {e.actor}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

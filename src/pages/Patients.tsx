import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, BedDouble } from "lucide-react";

export default function Patients() {
  const { state } = useAppStore();
  const [query, setQuery] = useState("");

  const patients = useMemo(() => {
    const all = Object.values(state.patients);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.mrn?.toLowerCase().includes(q),
    );
  }, [state.patients, query]);

  const investigationCounts = useMemo(() => {
    const map = new Map<string, { active: number; total: number }>();
    for (const inv of Object.values(state.investigations)) {
      const cur = map.get(inv.patientId) ?? { active: 0, total: 0 };
      cur.total += 1;
      if (inv.status !== "Reviewed by Doctor") cur.active += 1;
      map.set(inv.patientId, cur);
    }
    return map;
  }, [state.investigations]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Patients</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search by name or patient ID. Click a patient to manage their investigations.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or ID (e.g. P-1042, Robert)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {patients.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="p-8 text-center text-muted-foreground">
              No patients match "{query}".
            </CardContent>
          </Card>
        )}
        {patients.map((patient) => {
          const counts = investigationCounts.get(patient.id) ?? { active: 0, total: 0 };
          return (
            <Link key={patient.id} href={`/patients/${patient.id}`}>
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {patient.name
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium truncate">{patient.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {patient.mrn ?? patient.id}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>
                        {patient.age}y · {patient.gender}
                      </span>
                      <span className="text-border">|</span>
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {patient.ward} · {patient.bed}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-medium text-primary tabular-nums">
                      {counts.active} active
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {counts.total} total
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

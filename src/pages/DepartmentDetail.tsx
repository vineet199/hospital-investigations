import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { StatusStepper } from "@/components/StatusStepper";
import { ArrowLeft, PlayCircle, FlaskConical, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { fullTime, pickTechnician } from "@/lib/format";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export default function DepartmentDetail() {
  const params = useParams<{ id: string }>();
  const { state, dispatch, can, isLoading } = useAppStore();
  const department = state.departments[params.id];

  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});

  const investigations = useMemo(() => {
    if (!department) return [];
    return Object.values(state.investigations)
      .filter((i) => i.departmentId === department.id)
      .sort((a, b) => {
        const order = { Stat: 0, Urgent: 1, Routine: 2 };
        return order[a.priority] - order[b.priority];
      });
  }, [state.investigations, department]);

  const groups = useMemo(() => {
    return {
      queued: investigations.filter((i) => i.status === "Sent to Department"),
      inProgress: investigations.filter((i) => i.status === "In Progress"),
      ready: investigations.filter((i) => i.status === "Result Ready"),
      completed: investigations.filter((i) => i.status === "Reviewed by Doctor"),
      ordered: investigations.filter((i) => i.status === "Ordered"),
    };
  }, [investigations]);

  if (!department) {
    return (
      <div className="flex flex-col gap-4 items-start">
        <Link href="/departments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to departments
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-muted-foreground">
            Department not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const canUpdateDepartment = department ? can("workDepartment", department.id) : false;

  const advance = async (id: string, next: "In Progress" | "Result Ready") => {
    const inv = state.investigations[id];
    if (!inv) return;
    const actor =
      inv.technician ??
      pickTechnician(inv.departmentId);
    try {
      await dispatch({
        type: "ADVANCE_STATUS",
        payload: { id, status: next, actor },
      });
      toast.success(
        next === "In Progress"
          ? `Started ${inv.type} for ${state.patients[inv.patientId]?.name}.`
          : `Result ready for ${inv.type}.`,
      );
    } catch {
      // Error toast is shown by the API-backed store.
    }
  };

  const saveResult = async (id: string) => {
    const inv = state.investigations[id];
    if (!inv) return;
    const notes = (resultDrafts[id] ?? inv.resultNotes ?? "").trim();
    if (!notes) {
      toast.error("Add result notes before saving.");
      return;
    }
    try {
      await dispatch({
        type: "ADD_RESULT_NOTES",
        payload: {
          id,
          notes,
          actor: inv.technician ?? pickTechnician(inv.departmentId),
        },
      });
      toast.success("Result saved.");
      setResultDrafts((d) => ({ ...d, [id]: "" }));
    } catch {
      // Error toast is shown by the Supabase-backed store.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/departments">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> All departments
          </Button>
        </Link>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{department.name}</h2>
              <p className="text-sm text-muted-foreground">
                {investigations.length} total investigations routed to this department
              </p>
              {!canUpdateDepartment && (
                <p className="text-xs text-amber-700 mt-1">
                  View-only for your role. Sign in as this department’s technician/admin to update work.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({groups.queued.length + groups.inProgress.length + groups.ready.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({groups.completed.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4 flex flex-col gap-6">
          <Section
            title="Result Ready — awaiting doctor review"
            items={groups.ready}
            empty="Nothing to hand off right now."
            renderActions={(inv) => (
              <div className="flex flex-col gap-2 w-full md:w-80 shrink-0">
                <Textarea
                  placeholder="Update or revise result notes…"
                  value={resultDrafts[inv.id] ?? inv.resultNotes ?? ""}
                  onChange={(e) =>
                    setResultDrafts((d) => ({ ...d, [inv.id]: e.target.value }))
                  }
                  className="min-h-[72px] text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => saveResult(inv.id)} disabled={!canUpdateDepartment || isLoading}>
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Update Result
                </Button>
              </div>
            )}
          />
          <Section
            title="In Progress"
            items={groups.inProgress}
            empty="No investigations being processed."
            renderActions={(inv) => (
              <div className="flex flex-col gap-2 w-full md:w-80 shrink-0">
                <Textarea
                  placeholder="Enter result notes…"
                  value={resultDrafts[inv.id] ?? ""}
                  onChange={(e) =>
                    setResultDrafts((d) => ({ ...d, [inv.id]: e.target.value }))
                  }
                  className="min-h-[72px] text-sm"
                />
                <Button size="sm" onClick={() => saveResult(inv.id)} disabled={!canUpdateDepartment || isLoading}>
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Save Result & Mark Ready
                </Button>
              </div>
            )}
          />
          <Section
            title="Queue — Sent to Department"
            items={groups.queued}
            empty="No new investigations waiting."
            renderActions={(inv) => (
              <Button size="sm" variant="outline" onClick={() => advance(inv.id, "In Progress")} disabled={!canUpdateDepartment || isLoading}>
                <PlayCircle className="h-3.5 w-3.5 mr-1" /> Start Processing
              </Button>
            )}
          />
          {groups.ordered.length > 0 && (
            <Section
              title="Awaiting dispatch from ward"
              items={groups.ordered}
              empty=""
              renderActions={() => (
                <span className="text-xs text-muted-foreground italic">
                  Not yet sent by ordering doctor
                </span>
              )}
            />
          )}
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <Section
            title=""
            items={groups.completed}
            empty="No completed investigations yet."
            renderActions={() => null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({
  title,
  items,
  empty,
  renderActions,
}: {
  title: string;
  items: ReturnType<typeof Object.values<any>>;
  empty: string;
  renderActions: (inv: any) => React.ReactNode;
}) {
  const { state } = useAppStore();
  if (items.length === 0 && empty === "") return null;
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>{items.length} {items.length === 1 ? "investigation" : "investigations"}</CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">{empty}</div>
        ) : (
          items.map((inv: any) => {
            const patient = state.patients[inv.patientId];
            const orderedBy = state.doctors[inv.orderedByDoctorId];
            return (
              <div key={inv.id} className="border rounded-lg p-4 flex flex-col gap-3 bg-card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{inv.type}</span>
                      <PriorityBadge priority={inv.priority} />
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {patient?.name} · {patient?.id} · {patient?.ward} {patient?.bed}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Ordered by {orderedBy?.name} · {fullTime(inv.timeline[0]!.timestamp)}
                      {inv.technician && <> · Tech {inv.technician}</>}
                    </div>
                    {inv.notes && (
                      <div className="text-sm text-foreground/80 mt-2">{inv.notes}</div>
                    )}
                    {inv.resultNotes && (
                      <div className="border-l-2 border-primary/40 bg-primary/5 px-3 py-2 rounded-r mt-2">
                        <div className="text-[11px] font-medium text-primary uppercase tracking-wide">
                          Result
                        </div>
                        <div className="text-sm text-foreground mt-0.5">{inv.resultNotes}</div>
                      </div>
                    )}
                  </div>
                  <div>{renderActions(inv)}</div>
                </div>
                <StatusStepper investigation={inv} />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { StatusStepper } from "@/components/StatusStepper";
import {
  ArrowLeft,
  Plus,
  X,
  Send,
  CheckCircle2,
  BedDouble,
  User,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { INVESTIGATION_TYPES, pickTechnician, fullTime } from "@/lib/format";
import type { Priority } from "@/store/types";

interface DraftRow {
  id: string;
  type: string;
  priority: Priority;
  notes: string;
  departmentId: string;
}

function emptyRow(departmentDefault: string): DraftRow {
  return {
    id: `draft-${Math.random().toString(36).slice(2, 9)}`,
    type: "Blood Test",
    priority: "Routine",
    notes: "",
    departmentId: departmentDefault,
  };
}

export default function PatientDetail() {
  const params = useParams<{ id: string }>();
  const { state, dispatch, can, isLoading } = useAppStore();
  const patient = state.patients[params.id];
  const departments = Object.values(state.departments);
  const defaultDeptId = departments[0]?.id ?? "";
  const canCreateOrders = can("createOrders");
  const canDispatchOrders = can("dispatchOrders");
  const canReviewResults = can("reviewResults");

  const [drafts, setDrafts] = useState<DraftRow[]>([emptyRow(defaultDeptId)]);
  const [resultDialog, setResultDialog] = useState<{
    open: boolean;
    investigationId?: string;
    notes: string;
  }>({ open: false, notes: "" });

  const investigations = useMemo(() => {
    if (!patient) return [];
    return Object.values(state.investigations)
      .filter((i) => i.patientId === patient.id)
      .sort(
        (a, b) =>
          new Date(b.timeline[0]!.timestamp).getTime() -
          new Date(a.timeline[0]!.timestamp).getTime(),
      );
  }, [state.investigations, patient]);

  const auditLog = useMemo(() => {
    return investigations
      .flatMap((inv) =>
        inv.timeline.map((e) => ({
          ...e,
          investigationType: inv.type,
          investigationId: inv.id,
          departmentName: state.departments[inv.departmentId]?.name ?? "—",
        })),
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [investigations, state.departments]);

  if (!patient) {
    return (
      <div className="flex flex-col gap-4 items-start">
        <Link href="/patients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to patients
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-muted-foreground">
            Patient not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeDraft = (id: string) => {
    setDrafts((d) => (d.length === 1 ? d : d.filter((r) => r.id !== id)));
  };
  const addDraft = () => setDrafts((d) => [...d, emptyRow(defaultDeptId)]);

  const submitDrafts = async () => {
    const valid = drafts.filter((d) => d.type && d.departmentId);
    if (valid.length === 0) {
      toast.error("Add at least one valid investigation.");
      return;
    }
    try {
      await dispatch({
        type: "ADD_INVESTIGATIONS",
        payload: valid.map((d) => ({
          patientId: patient.id,
          orderedByDoctorId: state.currentDoctorId,
          type: d.type,
          notes: d.notes,
          priority: d.priority,
          departmentId: d.departmentId,
        })),
      });
      toast.success(
        `${valid.length} ${valid.length === 1 ? "investigation" : "investigations"} ordered for ${patient.name}.`,
      );
      setDrafts([emptyRow(defaultDeptId)]);
    } catch {
      // Error toast is shown by the API-backed store.
    }
  };

  const sendToDept = async (id: string) => {
    const inv = state.investigations[id];
    if (!inv) return;
    try {
      await dispatch({
        type: "SEND_TO_DEPARTMENT",
        payload: {
          id,
          actor: state.doctors[state.currentDoctorId]?.name ?? "Unknown",
          technician: pickTechnician(inv.departmentId),
        },
      });
      toast.success(`Sent to ${state.departments[inv.departmentId]?.name}.`);
    } catch {
      // Error toast is shown by the API-backed store.
    }
  };

  const markReviewed = async (id: string) => {
    try {
      await dispatch({
        type: "MARK_REVIEWED",
        payload: {
          id,
          actor: state.doctors[state.currentDoctorId]?.name ?? "Unknown",
        },
      });
      toast.success("Marked as reviewed.");
    } catch {
      // Error toast is shown by the API-backed store.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/patients">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> All patients
          </Button>
        </Link>
        <Card>
          <CardContent className="p-5 flex items-center gap-5 flex-wrap">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
              {patient.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-xl font-semibold tracking-tight">{patient.name}</h2>
                <span className="text-sm text-muted-foreground tabular-nums">{patient.id}</span>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> {patient.age}y · {patient.gender}
                </span>
                <span className="flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5" /> {patient.ward} · {patient.bed}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Investigations
          </CardTitle>
          <CardDescription>
            {canCreateOrders
              ? "Add one or more investigations to order. Each row is assigned to a target department."
              : "Only doctors and admins can place new investigation orders."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!canCreateOrders && (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
              You can still view this patient’s investigation history, but ordering is disabled for your role.
            </div>
          )}
          {canCreateOrders && drafts.map((row, idx) => (
            <div
              key={row.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border rounded-lg bg-muted/30"
            >
              <div className="md:col-span-3 flex flex-col gap-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={row.type} onValueChange={(v) => updateDraft(row.id, { type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTIGATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={row.priority}
                  onValueChange={(v: Priority) => updateDraft(row.id, { priority: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Routine">Routine</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="Stat">Stat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 flex flex-col gap-1.5">
                <Label className="text-xs">Send to</Label>
                <Select
                  value={row.departmentId}
                  onValueChange={(v) => updateDraft(row.id, { departmentId: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 flex flex-col gap-1.5">
                <Label className="text-xs">Notes</Label>
                <Input
                  placeholder="Clinical notes (optional)"
                  value={row.notes}
                  onChange={(e) => updateDraft(row.id, { notes: e.target.value })}
                />
              </div>
              <div className="md:col-span-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDraft(row.id)}
                  disabled={drafts.length === 1}
                  aria-label="Remove row"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {canCreateOrders && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button variant="outline" size="sm" onClick={addDraft}>
              <Plus className="h-4 w-4 mr-1" /> Add another
            </Button>
            <Button onClick={submitDrafts} disabled={isLoading}>
              {isLoading ? "Submitting…" : `Submit ${drafts.length} ${drafts.length === 1 ? "Order" : "Orders"}`}
            </Button>
          </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Investigations ({investigations.length})
          </CardTitle>
          <CardDescription>Live status and full history for this patient.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {investigations.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
              No investigations yet for this patient.
            </div>
          )}
          {investigations.map((inv) => {
            const dept = state.departments[inv.departmentId];
            const orderedBy = state.doctors[inv.orderedByDoctorId];
            return (
              <div key={inv.id} className="border rounded-lg p-4 flex flex-col gap-3 bg-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{inv.type}</span>
                      <PriorityBadge priority={inv.priority} />
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {dept?.name} · Ordered by {orderedBy?.name}
                      {inv.technician && <> · Technician {inv.technician}</>}
                    </div>
                    {inv.notes && (
                      <div className="text-sm text-foreground/80 mt-2">{inv.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === "Ordered" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendToDept(inv.id)}
                        disabled={!canDispatchOrders || isLoading}
                        title={!canDispatchOrders ? "Only doctors, nurses, and admins can dispatch orders" : undefined}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> Send to {dept?.name}
                      </Button>
                    )}
                    {inv.status === "Result Ready" && (
                      <Button
                        size="sm"
                        onClick={() => markReviewed(inv.id)}
                        disabled={!canReviewResults || isLoading}
                        title={!canReviewResults ? "Only doctors and admins can review results" : undefined}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Reviewed
                      </Button>
                    )}
                  </div>
                </div>

                <StatusStepper investigation={inv} />

                {inv.resultNotes && (
                  <div className="border-l-2 border-primary/40 bg-primary/5 px-3 py-2 rounded-r">
                    <div className="text-[11px] font-medium text-primary uppercase tracking-wide">
                      Result
                    </div>
                    <div className="text-sm text-foreground mt-0.5">{inv.resultNotes}</div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Trail</CardTitle>
          <CardDescription>Every event for {patient.name}, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {auditLog.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            <ol className="flex flex-col">
              {auditLog.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 px-6 py-3 border-b last:border-b-0"
                >
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {e.stage}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{e.investigationType}</span>{" "}
                      <span className="text-muted-foreground">at {e.departmentName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      by {e.actor} · {fullTime(e.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={resultDialog.open}
        onOpenChange={(open) => setResultDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Result Notes</DialogTitle>
            <DialogDescription>This is shown in the patient profile and history.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter result notes…"
            value={resultDialog.notes}
            onChange={(e) => setResultDialog((s) => ({ ...s, notes: e.target.value }))}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResultDialog({ open: false, notes: "" })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

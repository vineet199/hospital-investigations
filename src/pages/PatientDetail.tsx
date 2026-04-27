import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useAppStore } from "@/store/AppStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface OrderMeta {
  clinicalDiagnosis: string;
  provisionalDiagnosis: string;
  specimen: string;
  billingClass: string;
  paymentType: string;
  collectionTiming: string;
  lmp: string;
  remarks: string;
}

interface RequisitionSection {
  title: string;
  departmentId: string;
  tests: string[];
}

const PATIENT_CLASS_OPTIONS = ["IPD", "OPD", "Emergency", "Day care"];
const PAYMENT_OPTIONS = ["Cash", "Credit", "Insurance", "Corporate", "Package"];
const SPECIMEN_OPTIONS = [
  "Blood",
  "Urine",
  "Stool",
  "Sputum",
  "Swab",
  "Tissue / biopsy",
  "Fluid / CSF",
  "Imaging / no specimen",
  "Other",
];
const COLLECTION_TIMING_OPTIONS = [
  "Fasting",
  "Post-prandial",
  "Random",
  "24-hour sample",
  "Pre-op",
  "Post-op",
];

const REQUISITION_SECTIONS: RequisitionSection[] = [
  {
    title: "Haematology / Coagulation",
    departmentId: "DEP-3",
    tests: [
      "CBC / Complete haemogram",
      "Hb",
      "TLC / WBC count",
      "DLC",
      "ESR",
      "Platelet count",
      "Peripheral smear",
      "Reticulocyte count",
      "Blood group & Rh",
      "BT / CT",
      "PT / INR",
      "APTT",
      "Malaria parasite",
      "Sickling test",
    ],
  },
  {
    title: "Biochemistry",
    departmentId: "DEP-3",
    tests: [
      "Blood sugar - fasting",
      "Blood sugar - PP",
      "Blood sugar - random",
      "HbA1c",
      "Urea",
      "Creatinine",
      "Uric acid",
      "Sodium",
      "Potassium",
      "Chloride",
      "Calcium",
      "Phosphorus",
      "Total bilirubin",
      "Direct bilirubin",
      "SGOT / AST",
      "SGPT / ALT",
      "Alkaline phosphatase",
      "Total protein",
      "Albumin",
      "Globulin",
      "LFT",
      "RFT / KFT",
      "Lipid profile",
      "Cholesterol",
      "Triglycerides",
      "HDL",
      "LDL",
      "Amylase",
      "Lipase",
    ],
  },
  {
    title: "Serology / Immunology",
    departmentId: "DEP-3",
    tests: [
      "HIV I & II",
      "HBsAg",
      "Anti-HCV",
      "VDRL",
      "Widal",
      "Dengue NS1",
      "Dengue IgM",
      "Dengue IgG",
      "Malaria antigen",
      "Typhidot",
      "CRP",
      "RA factor",
      "ASO titre",
      "H. pylori",
      "COVID antigen / RT-PCR",
    ],
  },
  {
    title: "Urine / Stool / Clinical Pathology",
    departmentId: "DEP-3",
    tests: [
      "Urine routine & microscopy",
      "Urine albumin",
      "Urine sugar",
      "Urine ketone",
      "Urine pregnancy test",
      "Urine culture",
      "24-hour urine protein",
      "Stool routine & microscopy",
      "Stool occult blood",
      "Stool ova / cyst",
    ],
  },
  {
    title: "Microbiology / Cultures",
    departmentId: "DEP-3",
    tests: [
      "Blood culture & sensitivity",
      "Urine culture & sensitivity",
      "Sputum culture & sensitivity",
      "Pus culture & sensitivity",
      "Wound swab culture",
      "Throat swab culture",
      "CSF culture",
      "Gram stain",
      "AFB stain",
      "KOH mount",
    ],
  },
  {
    title: "Hormones / Special Tests",
    departmentId: "DEP-3",
    tests: [
      "T3",
      "T4",
      "TSH",
      "Vitamin D",
      "Vitamin B12",
      "Ferritin",
      "D-dimer",
      "Troponin I",
      "Procalcitonin",
      "PSA",
      "CA-125",
      "Beta-hCG",
      "FSH",
      "LH",
      "Prolactin",
    ],
  },
  {
    title: "Radiology / Imaging",
    departmentId: "DEP-4",
    tests: [
      "X-Ray",
      "USG / Ultrasound",
      "CT Scan",
      "MRI",
      "Doppler",
      "Mammography",
      "Contrast study",
    ],
  },
  {
    title: "Cardiology",
    departmentId: "DEP-6",
    tests: ["ECG", "2D Echo", "TMT", "Holter monitoring", "Cardiac enzymes"],
  },
  {
    title: "Blood Bank",
    departmentId: "DEP-5",
    tests: [
      "Blood grouping",
      "Cross match",
      "Coombs test",
      "Component request",
      "Transfusion reaction workup",
    ],
  },
];

const REQUISITION_TEST_LOOKUP: Map<
  string,
  { section: RequisitionSection; test: string }
> = new Map(
  REQUISITION_SECTIONS.flatMap((section) =>
    section.tests.map(
      (test) => [`${section.title}:${test}`, { section, test }] as const,
    ),
  ),
);

function splitMultiValue(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinMultiValue(values: string[]) {
  return values.join(", ");
}

function emptyRow(departmentDefault: string): DraftRow {
  return {
    id: `draft-${Math.random().toString(36).slice(2, 9)}`,
    type: "",
    priority: "Routine",
    notes: "",
    departmentId: departmentDefault,
  };
}

function buildInvestigationNotes(row: DraftRow, meta: OrderMeta) {
  return [
    meta.provisionalDiagnosis.trim()
      ? `Provisional diagnosis: ${meta.provisionalDiagnosis.trim()}`
      : "",
    meta.clinicalDiagnosis.trim()
      ? `Clinical diagnosis: ${meta.clinicalDiagnosis.trim()}`
      : "",
    meta.specimen ? `Specimen/source: ${meta.specimen}` : "",
    meta.billingClass ? `Patient class: ${meta.billingClass}` : "",
    meta.paymentType ? `Payment/category: ${meta.paymentType}` : "",
    meta.collectionTiming ? `Collection/timing: ${meta.collectionTiming}` : "",
    meta.lmp.trim() ? `LMP: ${meta.lmp.trim()}` : "",
    meta.remarks.trim() ? `Remarks: ${meta.remarks.trim()}` : "",
    row.notes.trim() ? `Instructions: ${row.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function PatientDetail() {
  const params = useParams<{ id: string }>();
  const { state, user, dispatch, can, isLoading } = useAppStore();
  const patient = state.patients[params.id];
  const departments = Object.values(state.departments);
  const defaultDeptId = departments[0]?.id ?? "";
  const requestedAt = useMemo(() => new Date().toLocaleString(), []);
  const canCreateOrders = can("createOrders");
  const canDispatchOrders = can("dispatchOrders");
  const canReviewResults = can("reviewResults");

  const [drafts, setDrafts] = useState<DraftRow[]>([emptyRow(defaultDeptId)]);
  const [selectedTestKeys, setSelectedTestKeys] = useState<string[]>([]);
  const [orderMeta, setOrderMeta] = useState<OrderMeta>({
    clinicalDiagnosis: "",
    provisionalDiagnosis: "",
    specimen: "Blood",
    billingClass: "IPD",
    paymentType: "Cash",
    collectionTiming: "Random",
    lmp: "",
    remarks: "",
  });
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
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
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

  const toggleRequisitionTest = (key: string, checked: boolean) => {
    setSelectedTestKeys((previous) => {
      if (checked)
        return previous.includes(key) ? previous : [...previous, key];
      return previous.filter((item) => item !== key);
    });
  };

  const setSectionTests = (section: RequisitionSection, tests: string[]) => {
    const sectionKeys = new Set(
      section.tests.map((test) => `${section.title}:${test}`),
    );
    setSelectedTestKeys((previous) => [
      ...previous.filter((key) => !sectionKeys.has(key)),
      ...tests.map((test) => `${section.title}:${test}`),
    ]);
  };

  const setSingleMetaValue = (field: keyof OrderMeta, value: string) => {
    setOrderMeta((meta) => ({ ...meta, [field]: value }));
  };

  const submitDrafts = async () => {
    const selectedRows: DraftRow[] = selectedTestKeys.flatMap((key) => {
      const item = REQUISITION_TEST_LOOKUP.get(key);
      if (!item) return [];
      return [
        {
          id: key,
          type: item.test,
          priority: "Routine" as Priority,
          notes: "",
          departmentId: item.section.departmentId,
        },
      ];
    });
    const valid = [
      ...selectedRows,
      ...drafts.filter((d) => d.type.trim() && d.departmentId),
    ];
    if (valid.length === 0) {
      toast.error(
        "Select at least one checkbox test or add one valid investigation.",
      );
      return;
    }
    try {
      await dispatch({
        type: "ADD_INVESTIGATIONS",
        payload: valid.map((d) => ({
          patientId: patient.id,
          orderedByDoctorId: state.currentDoctorId,
          type: d.type.trim(),
          notes: buildInvestigationNotes(d, orderMeta),
          priority: d.priority,
          departmentId: d.departmentId,
        })),
      });
      toast.success(
        `${valid.length} ${valid.length === 1 ? "investigation" : "investigations"} ordered for ${patient.name}.`,
      );
      setDrafts([emptyRow(defaultDeptId)]);
      setSelectedTestKeys([]);
    } catch {
      // Error toast is shown by the Supabase-backed store.
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
      // Error toast is shown by the Supabase-backed store.
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
      // Error toast is shown by the Supabase-backed store.
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
                <h2 className="text-xl font-semibold tracking-tight">
                  {patient.name}
                </h2>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {patient.id}
                </span>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> {patient.age}y ·{" "}
                  {patient.gender}
                </span>
                <span className="flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5" /> {patient.ward} ·{" "}
                  {patient.bed}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Investigation Requisition Form
          </CardTitle>
          <CardDescription>
            {canCreateOrders
              ? "Paper-style request form with patient details, consultant, clinical notes, specimen, and ordered tests."
              : "Only doctors and admins can place new investigation orders."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <datalist id="investigation-type-options">
            {INVESTIGATION_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
          {!canCreateOrders && (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
              You can still view this patient’s investigation history, but
              ordering is disabled for your role.
            </div>
          )}
          {canCreateOrders && (
            <>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3 border-b pb-3 mb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Patient / ward details and request information
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Includes all printed-form fields: patient category,
                      specimen, timing, clinical details, and remarks.
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {orderMeta.billingClass}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3 flex flex-col gap-1.5">
                    <Label className="text-xs">MRN / Patient ID</Label>
                    <Input
                      readOnly
                      value={`${patient.mrn ?? patient.id} / ${patient.id}`}
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-3 flex flex-col gap-1.5">
                    <Label className="text-xs">Patient name</Label>
                    <Input
                      readOnly
                      value={patient.name}
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs">Age / sex</Label>
                    <Input
                      readOnly
                      value={`${patient.age}y / ${patient.gender}`}
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs">Ward / bed</Label>
                    <Input
                      readOnly
                      value={`${patient.ward} / ${patient.bed}`}
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs">Date / time</Label>
                    <Input
                      readOnly
                      value={requestedAt}
                      className="bg-background"
                    />
                  </div>
                  <OptionSelector
                    className="md:col-span-4"
                    label="Patient class"
                    options={PATIENT_CLASS_OPTIONS}
                    values={splitMultiValue(orderMeta.billingClass)}
                    onChange={(values) =>
                      setSingleMetaValue("billingClass", joinMultiValue(values))
                    }
                  />
                  <OptionSelector
                    className="md:col-span-4"
                    label="Payment / category"
                    options={PAYMENT_OPTIONS}
                    values={splitMultiValue(orderMeta.paymentType)}
                    onChange={(values) =>
                      setSingleMetaValue("paymentType", joinMultiValue(values))
                    }
                  />
                  <OptionSelector
                    className="md:col-span-4"
                    label="Collection / timing"
                    options={COLLECTION_TIMING_OPTIONS}
                    values={splitMultiValue(orderMeta.collectionTiming)}
                    onChange={(values) =>
                      setSingleMetaValue(
                        "collectionTiming",
                        joinMultiValue(values),
                      )
                    }
                  />
                  <OptionSelector
                    className="md:col-span-4"
                    label="Specimen / source"
                    options={SPECIMEN_OPTIONS}
                    values={splitMultiValue(orderMeta.specimen)}
                    onChange={(values) =>
                      setSingleMetaValue("specimen", joinMultiValue(values))
                    }
                  />

                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <Label className="text-xs">Provisional diagnosis</Label>
                    <Textarea
                      placeholder="Provisional diagnosis"
                      value={orderMeta.provisionalDiagnosis}
                      onChange={(event) =>
                        setOrderMeta((meta) => ({
                          ...meta,
                          provisionalDiagnosis: event.target.value,
                        }))
                      }
                      className="min-h-[56px] bg-background"
                    />
                  </div>
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <Label className="text-xs">
                      Clinical diagnosis / indication
                    </Label>
                    <Textarea
                      placeholder="Diagnosis, provisional diagnosis, or reason for investigation"
                      value={orderMeta.clinicalDiagnosis}
                      onChange={(event) =>
                        setOrderMeta((meta) => ({
                          ...meta,
                          clinicalDiagnosis: event.target.value,
                        }))
                      }
                      className="min-h-[56px] bg-background"
                    />
                  </div>
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <Label className="text-xs">
                      Consultant / requesting doctor
                    </Label>
                    <Select
                      value={state.currentDoctorId}
                      disabled={user.role !== "Admin"}
                      onValueChange={(val) =>
                        dispatch({ type: "SET_CURRENT_DOCTOR", payload: val })
                      }
                    >
                      <SelectTrigger className="bg-background">
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
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs">LMP</Label>
                    <Input
                      placeholder="If applicable"
                      value={orderMeta.lmp}
                      onChange={(event) =>
                        setOrderMeta((meta) => ({
                          ...meta,
                          lmp: event.target.value,
                        }))
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs">Remarks</Label>
                    <Textarea
                      placeholder="Additional remarks"
                      value={orderMeta.remarks}
                      onChange={(event) =>
                        setOrderMeta((meta) => ({
                          ...meta,
                          remarks: event.target.value,
                        }))
                      }
                      className="min-h-[56px] bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3 border-b">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Investigation checklist
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Select tests from the printed requisition categories.
                      Selected: {selectedTestKeys.length}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  {REQUISITION_SECTIONS.map((section) => (
                    <div
                      key={section.title}
                      className="rounded-md border bg-muted/10 p-3"
                    >
                      <div className="text-sm font-semibold mb-1">
                        {section.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground mb-3">
                        Routed to{" "}
                        {state.departments[section.departmentId]?.name ??
                          section.departmentId}
                      </div>
                      <OptionSelector
                        label="Tests"
                        options={section.tests}
                        values={section.tests.filter((test) =>
                          selectedTestKeys.includes(`${section.title}:${test}`),
                        )}
                        onChange={(tests) => setSectionTests(section, tests)}
                        onSmallToggle={(test, checked) =>
                          toggleRequisitionTest(
                            `${section.title}:${test}`,
                            checked,
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <div className="col-span-3">
                    Additional investigation / test
                  </div>
                  <div className="col-span-3">Department / lab</div>
                  <div className="col-span-2">Priority</div>
                  <div className="col-span-3">Special instructions</div>
                  <div className="col-span-1 text-right">Remove</div>
                </div>

                {drafts.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border-t first:border-t-0 md:first:border-t bg-card"
                  >
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label className="text-xs md:hidden">
                        Investigation / test required
                      </Label>
                      <Input
                        list="investigation-type-options"
                        placeholder="Other test not listed above"
                        value={row.type}
                        onChange={(event) =>
                          updateDraft(row.id, { type: event.target.value })
                        }
                      />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label className="text-xs md:hidden">
                        Department / lab
                      </Label>
                      <Select
                        value={row.departmentId}
                        onValueChange={(v) =>
                          updateDraft(row.id, { departmentId: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <Label className="text-xs md:hidden">Priority</Label>
                      <Select
                        value={row.priority}
                        onValueChange={(v: Priority) =>
                          updateDraft(row.id, { priority: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Routine">Routine</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                          <SelectItem value="Stat">Stat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label className="text-xs md:hidden">
                        Special instructions
                      </Label>
                      <Input
                        placeholder="Fasting, contrast, repeat, etc."
                        value={row.notes}
                        onChange={(e) =>
                          updateDraft(row.id, { notes: e.target.value })
                        }
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
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button variant="outline" size="sm" onClick={addDraft}>
                  <Plus className="h-4 w-4 mr-1" /> Add another test
                </Button>
                <Button onClick={submitDrafts} disabled={isLoading}>
                  {isLoading && <Spinner className="mr-2" />}
                  {isLoading
                    ? "Submitting…"
                    : `Submit ${drafts.length} ${drafts.length === 1 ? "Order" : "Orders"}`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Investigations (
            {investigations.length})
          </CardTitle>
          <CardDescription>
            Live status and full history for this patient.
          </CardDescription>
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
              <div
                key={inv.id}
                className="border rounded-lg p-4 flex flex-col gap-3 bg-card"
              >
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
                      <div className="text-sm text-foreground/80 mt-2">
                        {inv.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === "Ordered" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendToDept(inv.id)}
                        disabled={!canDispatchOrders || isLoading}
                        title={
                          !canDispatchOrders
                            ? "Only doctors, nurses, and admins can dispatch orders"
                            : undefined
                        }
                      >
                        {isLoading && <Spinner className="mr-2" />}
                        <Send className="h-3.5 w-3.5 mr-1" /> Send to{" "}
                        {dept?.name}
                      </Button>
                    )}
                    {!["Ordered", "Reviewed by Doctor"].includes(
                      inv.status,
                    ) && (
                      <Link href={`/departments/${inv.departmentId}`}>
                        <Button size="sm" variant="outline">
                          Open {dept?.name ?? "department"} workbench
                        </Button>
                      </Link>
                    )}
                    {inv.status === "Result Ready" && (
                      <Button
                        size="sm"
                        onClick={() => markReviewed(inv.id)}
                        disabled={!canReviewResults || isLoading}
                        title={
                          !canReviewResults
                            ? "Only doctors and admins can review results"
                            : undefined
                        }
                      >
                        {isLoading && <Spinner className="mr-2" />}
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark
                        Reviewed
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
                    <div className="text-sm text-foreground mt-0.5">
                      {inv.resultNotes}
                    </div>
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
          <CardDescription>
            Every event for {patient.name}, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {auditLog.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              No activity yet.
            </div>
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
                      <span className="text-muted-foreground">
                        at {e.departmentName}
                      </span>
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
            <DialogDescription>
              This is shown in the patient profile and history.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter result notes…"
            value={resultDialog.notes}
            onChange={(e) =>
              setResultDialog((s) => ({ ...s, notes: e.target.value }))
            }
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

function CheckboxLine({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `check-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-2 text-xs leading-snug cursor-pointer"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}

function OptionSelector({
  label,
  options,
  values,
  onChange,
  onSmallToggle,
  className = "",
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  onSmallToggle?: (option: string, checked: boolean) => void;
  className?: string;
}) {
  const selected = new Set(values);
  const summary =
    values.length === 0
      ? "Select"
      : values.length <= 2
        ? values.join(", ")
        : `${values.length} selected`;

  const toggle = (option: string, checked: boolean) => {
    if (checked)
      onChange(
        [...values, option].filter(
          (item, index, array) => array.indexOf(item) === index,
        ),
      );
    else onChange(values.filter((item) => item !== option));
  };

  if (options.length <= 3) {
    return (
      <div
        className={`flex flex-col gap-1.5 rounded-md border bg-background p-3 ${className}`}
      >
        <Label className="text-xs">{label}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map((option) => (
            <CheckboxLine
              key={option}
              label={option}
              checked={selected.has(option)}
              onCheckedChange={(checked) => {
                onSmallToggle?.(option, checked);
                toggle(option, checked);
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border bg-background p-3 ${className}`}
    >
      <Label className="text-xs">{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="justify-between h-auto min-h-9 text-left font-normal"
          >
            <span className="truncate">{summary}</span>
            {values.length > 0 && (
              <Badge variant="secondary" className="ml-2 shrink-0">
                {values.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-72 max-h-80 overflow-y-auto"
          align="start"
        >
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.has(option)}
              onCheckedChange={(checked) => {
                onSmallToggle?.(option, checked === true);
                toggle(option, checked === true);
              }}
              onSelect={(event) => event.preventDefault()}
            >
              {option}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {values.slice(0, 6).map((value) => (
            <Badge key={value} variant="secondary" className="text-[10px]">
              {value}
            </Badge>
          ))}
          {values.length > 6 && (
            <Badge variant="outline" className="text-[10px]">
              +{values.length - 6} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

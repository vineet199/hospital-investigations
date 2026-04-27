import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/AppStore";
import { databaseAdapter } from "@/lib/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  UserPlus,
  UserRoundPlus,
  ListChecks,
  Receipt,
  Pill,
  Printer,
  ShieldCheck,
  Rocket,
} from "lucide-react";
import type { UserRole } from "@/store/types";

type Row = Record<string, any>;

const ROLE_OPTIONS: UserRole[] = [
  "Admin",
  "Doctor",
  "Nurse",
  "Technician",
  "Department Head",
  "Pharmacist",
  "Billing",
  "Reception",
];

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default function AdminSuite() {
  const { tenant, user, state, refresh } = useAppStore();
  const [isBusy, setIsBusy] = useState(false);
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const isPlatformAdmin = user.role === "Platform Admin";
  const isHospitalWorkspace = tenant.slug !== "platform";
  const isHospitalAdmin = user.role === "Admin" && isHospitalWorkspace;
  const isAdmin = isPlatformAdmin || isHospitalAdmin;
  const canRegisterPatients = isHospitalWorkspace && (isHospitalAdmin || user.role === "Reception" || user.role === "Nurse" || user.role === "Doctor");
  const canBill = isHospitalWorkspace && (isHospitalAdmin || user.role === "Billing" || user.role === "Reception");
  const canPharmacy = isHospitalWorkspace && (isHospitalAdmin || user.role === "Pharmacist");

  const [hospitalForm, setHospitalForm] = useState({
    name: "",
    slug: "",
    adminEmail: "",
    adminName: "",
  });
  const [settingsForm, setSettingsForm] = useState({
    legalName: tenant.name,
    address: "",
    phone: "",
    email: "",
    website: "",
    gstNumber: "",
    licenseNumber: "",
    reportFooter: "",
  });
  const [staffForm, setStaffForm] = useState({
    email: "",
    name: "",
    role: "Doctor" as UserRole,
    departmentId: "none",
    doctorId: "none",
  });
  const [patientForm, setPatientForm] = useState({
    mrn: "",
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    address: "",
    guardianName: "",
    emergencyContact: "",
    patientClass: "OPD",
    ward: "OPD",
    bed: "-",
  });
  const [catalogForm, setCatalogForm] = useState({
    name: "",
    code: "",
    categoryId: "CAT-GENERAL",
    categoryName: "General",
    departmentId: "DEP-3",
    sampleTypeId: "SAMPLE-BLOOD",
    price: "0",
    turnaroundHours: "24",
    instructions: "",
  });
  const [billingInvestigationId, setBillingInvestigationId] = useState("");
  const [medicineForm, setMedicineForm] = useState({
    genericName: "",
    brandName: "",
    strength: "",
    dosageForm: "Tablet",
    manufacturer: "",
    reorderLevel: "0",
  });
  const [stockForm, setStockForm] = useState({
    medicineId: "",
    batchNumber: "",
    expiryDate: "",
    quantity: "0",
    sellingPrice: "0",
    reason: "Opening stock",
  });

  const departments = Object.values(state.departments);
  const investigations = Object.values(state.investigations);

  const loadData = useCallback(async () => {
    if (!databaseAdapter.isConfigured) return;
    setLoadError(null);
    const tables = [
      "tenants",
      "tenant_settings",
      "tenant_branding",
      "tenant_modules",
      "tenant_subscriptions",
      "plans",
      "wards",
      "beds",
      "tenant_memberships",
      "staff_invitations",
      "doctor_profiles",
      "admissions",
      "sample_types",
      "investigation_categories",
      "investigation_catalog",
      "invoices",
      "invoice_items",
      "payments",
      "report_templates",
      "generated_reports",
      "pharmacy_stores",
      "medicines",
      "medicine_batches",
      "stock_movements",
      "audit_events",
    ];

    const next: Record<string, Row[]> = {};
    for (const table of tables) {
      try {
        next[table] = await databaseAdapter.selectRows<Row>(
          table,
          table === "plans" || table === "tenants"
            ? { limit: 200 }
            : { eq: { tenant_id: tenant.id }, limit: 200 },
        );
      } catch (error) {
        next[table] = [];
        const message = error instanceof Error ? error.message : String(error);
        if (!/does not exist|schema cache/i.test(message)) setLoadError(message);
      }
    }
    setData(next);

    const settings = next.tenant_settings?.[0];
    if (settings) {
      setSettingsForm((current) => ({
        ...current,
        legalName: settings.legal_name ?? tenant.name,
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        website: settings.website ?? "",
        gstNumber: settings.gst_number ?? "",
        licenseNumber: settings.license_number ?? "",
        reportFooter: settings.report_footer ?? "",
      }));
    }
  }, [tenant.id, tenant.name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function run(label: string, fn: () => Promise<void>) {
    setIsBusy(true);
    try {
      await fn();
      toast.success(label);
      await loadData();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete action.");
    } finally {
      setIsBusy(false);
    }
  }

  async function rpc(name: string, args: Row) {
    if (!databaseAdapter.isConfigured) throw new Error(`Database provider "${databaseAdapter.provider}" is not configured.`);
    await databaseAdapter.callFunction(name, args);
  }

  const activePlan = useMemo(() => {
    const subscription = data.tenant_subscriptions?.[0];
    return subscription?.plan_code ?? tenant.planCode ?? "trial";
  }, [data.tenant_subscriptions, tenant.planCode]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Onboarding & Operations Admin</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Combined Phase 1–5 control center for hospital onboarding, staff, patients, catalog, billing, pharmacy,
          reports, audit, and SaaS subscription scaffolding.
        </p>
      </div>

      {loadError && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Some onboarding tables are not available yet. Apply <code>supabase/migrations/002_onboarding_and_operations.sql</code> in Supabase, then refresh. Last error: {loadError}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Plan" value={PLAN_LABEL[activePlan] ?? activePlan} icon={<Rocket className="h-4 w-4" />} />
        <Metric title="Staff" value={data.tenant_memberships?.length ?? 0} icon={<Users className="h-4 w-4" />} />
        <Metric title="Catalog tests" value={data.investigation_catalog?.length ?? 0} icon={<ListChecks className="h-4 w-4" />} />
        <Metric title="Invoices" value={data.invoices?.length ?? 0} icon={<Receipt className="h-4 w-4" />} />
      </div>

      {isPlatformAdmin && (
        <Section icon={<Building2 className="h-4 w-4" />} title="Platform admin — create hospital tenant" description="Creates a tenant, first admin membership, default departments, modules, and trial subscription.">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Hospital name" value={hospitalForm.name} onChange={(name) => setHospitalForm((f) => ({ ...f, name }))} />
            <Field label="Slug" value={hospitalForm.slug} onChange={(slug) => setHospitalForm((f) => ({ ...f, slug }))} />
            <Field label="First admin email" value={hospitalForm.adminEmail} onChange={(adminEmail) => setHospitalForm((f) => ({ ...f, adminEmail }))} />
            <Field label="First admin name" value={hospitalForm.adminName} onChange={(adminName) => setHospitalForm((f) => ({ ...f, adminName }))} />
          </div>
          <Button disabled={isBusy || !hospitalForm.name || !hospitalForm.adminEmail} onClick={() => run("Hospital created", () => rpc("create_hospital", { p_name: hospitalForm.name, p_slug: hospitalForm.slug, p_admin_email: hospitalForm.adminEmail, p_admin_name: hospitalForm.adminName || "Hospital Admin" }))}>
            Create hospital
          </Button>
          <DataList rows={data.tenants ?? []} columns={["name", "slug", "status", "plan_code"]} />
        </Section>
      )}

      {isHospitalAdmin && (
        <Section icon={<Building2 className="h-4 w-4" />} title="Hospital settings & branding" description="Tenant profile used for reports, invoices, support, and commercial configuration.">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Legal name" value={settingsForm.legalName} onChange={(legalName) => setSettingsForm((f) => ({ ...f, legalName }))} />
            <Field label="Phone" value={settingsForm.phone} onChange={(phone) => setSettingsForm((f) => ({ ...f, phone }))} />
            <Field label="Email" value={settingsForm.email} onChange={(email) => setSettingsForm((f) => ({ ...f, email }))} />
            <Field label="Website" value={settingsForm.website} onChange={(website) => setSettingsForm((f) => ({ ...f, website }))} />
            <Field label="GST" value={settingsForm.gstNumber} onChange={(gstNumber) => setSettingsForm((f) => ({ ...f, gstNumber }))} />
            <Field label="License" value={settingsForm.licenseNumber} onChange={(licenseNumber) => setSettingsForm((f) => ({ ...f, licenseNumber }))} />
            <div className="md:col-span-2"><Field label="Address" value={settingsForm.address} onChange={(address) => setSettingsForm((f) => ({ ...f, address }))} /></div>
          </div>
          <Textarea value={settingsForm.reportFooter} onChange={(event) => setSettingsForm((f) => ({ ...f, reportFooter: event.target.value }))} placeholder="Report footer / legal note" />
          <Button disabled={isBusy} onClick={() => run("Hospital settings saved", () => rpc("upsert_tenant_settings", { p_tenant_id: tenant.id, p_settings: settingsForm }))}>Save settings</Button>
        </Section>
      )}

      {isHospitalAdmin && (
        <Section icon={<UserPlus className="h-4 w-4" />} title="Staff onboarding" description="Invite users and assign role, department, and doctor profile linkage.">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Field label="Email" value={staffForm.email} onChange={(email) => setStaffForm((f) => ({ ...f, email }))} />
            <Field label="Display name" value={staffForm.name} onChange={(name) => setStaffForm((f) => ({ ...f, name }))} />
            <SelectBox label="Role" value={staffForm.role} values={ROLE_OPTIONS} onChange={(role) => setStaffForm((f) => ({ ...f, role: role as UserRole }))} />
            <SelectBox label="Department" value={staffForm.departmentId} values={["none", ...departments.map((d) => d.id)]} labels={{ none: "None", ...Object.fromEntries(departments.map((d) => [d.id, d.name])) }} onChange={(departmentId) => setStaffForm((f) => ({ ...f, departmentId }))} />
            <SelectBox label="Doctor profile" value={staffForm.doctorId} values={["none", ...Object.values(state.doctors).map((d) => d.id)]} labels={{ none: "None", ...Object.fromEntries(Object.values(state.doctors).map((d) => [d.id, d.name])) }} onChange={(doctorId) => setStaffForm((f) => ({ ...f, doctorId }))} />
          </div>
          <Button disabled={isBusy || !staffForm.email || !staffForm.name} onClick={() => run("Staff invited", () => rpc("invite_staff", { p_tenant_id: tenant.id, p_email: staffForm.email, p_name: staffForm.name, p_role: staffForm.role, p_department_id: staffForm.departmentId === "none" ? null : staffForm.departmentId, p_doctor_id: staffForm.doctorId === "none" ? null : staffForm.doctorId }))}>Invite / update staff</Button>
          <DataList rows={data.tenant_memberships ?? []} columns={["display_name", "email", "role", "department_id", "doctor_id"]} />
        </Section>
      )}

      {canRegisterPatients && (
        <Section icon={<UserRoundPlus className="h-4 w-4" />} title="Patient registration & admission" description="Create/edit tenant-scoped patients with OPD/IPD/Emergency class, contact, guardian, ward, and bed details.">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="MRN" value={patientForm.mrn} onChange={(mrn) => setPatientForm((f) => ({ ...f, mrn }))} />
            <Field label="Name" value={patientForm.name} onChange={(name) => setPatientForm((f) => ({ ...f, name }))} />
            <Field label="Age" value={patientForm.age} onChange={(age) => setPatientForm((f) => ({ ...f, age }))} />
            <SelectBox label="Gender" value={patientForm.gender} values={["Male", "Female", "Other"]} onChange={(gender) => setPatientForm((f) => ({ ...f, gender }))} />
            <Field label="Phone" value={patientForm.phone} onChange={(phone) => setPatientForm((f) => ({ ...f, phone }))} />
            <Field label="Guardian" value={patientForm.guardianName} onChange={(guardianName) => setPatientForm((f) => ({ ...f, guardianName }))} />
            <Field label="Emergency contact" value={patientForm.emergencyContact} onChange={(emergencyContact) => setPatientForm((f) => ({ ...f, emergencyContact }))} />
            <SelectBox label="Class" value={patientForm.patientClass} values={["OPD", "IPD", "Emergency", "Day care"]} onChange={(patientClass) => setPatientForm((f) => ({ ...f, patientClass }))} />
            <Field label="Ward" value={patientForm.ward} onChange={(ward) => setPatientForm((f) => ({ ...f, ward }))} />
            <Field label="Bed" value={patientForm.bed} onChange={(bed) => setPatientForm((f) => ({ ...f, bed }))} />
            <div className="md:col-span-2"><Field label="Address" value={patientForm.address} onChange={(address) => setPatientForm((f) => ({ ...f, address }))} /></div>
          </div>
          <Button disabled={isBusy || !patientForm.name} onClick={() => run("Patient registered", () => rpc("register_patient", { p_tenant_id: tenant.id, p_patient: { ...patientForm, age: Number(patientForm.age || 0) } }))}>Register / update patient</Button>
        </Section>
      )}

      {isHospitalAdmin && (
        <Section icon={<ListChecks className="h-4 w-4" />} title="Investigation catalog" description="Hospital-specific test catalog with department routing, sample type, TAT, and price.">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Test name" value={catalogForm.name} onChange={(name) => setCatalogForm((f) => ({ ...f, name }))} />
            <Field label="Code" value={catalogForm.code} onChange={(code) => setCatalogForm((f) => ({ ...f, code }))} />
            <Field label="Category" value={catalogForm.categoryName} onChange={(categoryName) => setCatalogForm((f) => ({ ...f, categoryName }))} />
            <SelectBox label="Department" value={catalogForm.departmentId} values={departments.map((d) => d.id)} labels={Object.fromEntries(departments.map((d) => [d.id, d.name]))} onChange={(departmentId) => setCatalogForm((f) => ({ ...f, departmentId }))} />
            <Field label="Sample type ID" value={catalogForm.sampleTypeId} onChange={(sampleTypeId) => setCatalogForm((f) => ({ ...f, sampleTypeId }))} />
            <Field label="Price" value={catalogForm.price} onChange={(price) => setCatalogForm((f) => ({ ...f, price }))} />
            <Field label="TAT hours" value={catalogForm.turnaroundHours} onChange={(turnaroundHours) => setCatalogForm((f) => ({ ...f, turnaroundHours }))} />
            <Field label="Instructions" value={catalogForm.instructions} onChange={(instructions) => setCatalogForm((f) => ({ ...f, instructions }))} />
          </div>
          <Button disabled={isBusy || !catalogForm.name} onClick={() => run("Catalog item saved", () => rpc("upsert_catalog_item", { p_tenant_id: tenant.id, p_item: { ...catalogForm, price: Number(catalogForm.price || 0), turnaroundHours: Number(catalogForm.turnaroundHours || 24), active: true } }))}>Save test</Button>
          <DataList rows={data.investigation_catalog ?? []} columns={["code", "name", "department_id", "price", "turnaround_hours", "active"]} />
        </Section>
      )}

      {canBill && (
        <Section icon={<Receipt className="h-4 w-4" />} title="Billing MVP" description="Generate invoice items from investigation orders and track payment foundations.">
          <SelectBox label="Investigation" value={billingInvestigationId || "none"} values={["none", ...investigations.map((i) => i.id)]} labels={{ none: "Select investigation", ...Object.fromEntries(investigations.map((i) => [i.id, `${i.type} · ${state.patients[i.patientId]?.name ?? i.patientId}`])) }} onChange={(value) => setBillingInvestigationId(value === "none" ? "" : value)} />
          <Button disabled={isBusy || !billingInvestigationId} onClick={() => run("Invoice generated", () => rpc("create_invoice_for_investigation", { p_tenant_id: tenant.id, p_investigation_id: billingInvestigationId }))}>Generate invoice</Button>
          <DataList rows={data.invoices ?? []} columns={["id", "patient_id", "status", "total", "payment_status", "created_at"]} />
        </Section>
      )}

      {canPharmacy && (
        <Section icon={<Pill className="h-4 w-4" />} title="Pharmacy foundation" description="Medicine catalog, pharmacy stores, batch/expiry stock, and stock movement audit.">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Field label="Generic" value={medicineForm.genericName} onChange={(genericName) => setMedicineForm((f) => ({ ...f, genericName }))} />
            <Field label="Brand" value={medicineForm.brandName} onChange={(brandName) => setMedicineForm((f) => ({ ...f, brandName }))} />
            <Field label="Strength" value={medicineForm.strength} onChange={(strength) => setMedicineForm((f) => ({ ...f, strength }))} />
            <Field label="Form" value={medicineForm.dosageForm} onChange={(dosageForm) => setMedicineForm((f) => ({ ...f, dosageForm }))} />
            <Field label="Manufacturer" value={medicineForm.manufacturer} onChange={(manufacturer) => setMedicineForm((f) => ({ ...f, manufacturer }))} />
            <Field label="Reorder" value={medicineForm.reorderLevel} onChange={(reorderLevel) => setMedicineForm((f) => ({ ...f, reorderLevel }))} />
          </div>
          <Button disabled={isBusy || !medicineForm.genericName} onClick={() => run("Medicine saved", () => rpc("upsert_medicine", { p_tenant_id: tenant.id, p_item: { ...medicineForm, reorderLevel: Number(medicineForm.reorderLevel || 0), active: true } }))}>Save medicine</Button>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 border-t pt-3">
            <SelectBox label="Medicine" value={stockForm.medicineId || "none"} values={["none", ...(data.medicines ?? []).map((m) => m.id)]} labels={{ none: "Select medicine", ...Object.fromEntries((data.medicines ?? []).map((m) => [m.id, m.brand_name || m.generic_name])) }} onChange={(medicineId) => setStockForm((f) => ({ ...f, medicineId: medicineId === "none" ? "" : medicineId }))} />
            <Field label="Batch" value={stockForm.batchNumber} onChange={(batchNumber) => setStockForm((f) => ({ ...f, batchNumber }))} />
            <Field label="Expiry YYYY-MM-DD" value={stockForm.expiryDate} onChange={(expiryDate) => setStockForm((f) => ({ ...f, expiryDate }))} />
            <Field label="Quantity" value={stockForm.quantity} onChange={(quantity) => setStockForm((f) => ({ ...f, quantity }))} />
            <Field label="Selling price" value={stockForm.sellingPrice} onChange={(sellingPrice) => setStockForm((f) => ({ ...f, sellingPrice }))} />
          </div>
          <Button disabled={isBusy || !stockForm.medicineId} onClick={() => run("Stock adjusted", () => rpc("adjust_stock", { p_tenant_id: tenant.id, p_batch: { ...stockForm, quantity: Number(stockForm.quantity || 0), sellingPrice: Number(stockForm.sellingPrice || 0), storeId: "STORE-MAIN" } }))}>Adjust stock</Button>
          <DataList rows={data.medicines ?? []} columns={["generic_name", "brand_name", "strength", "dosage_form", "reorder_level"]} />
        </Section>
      )}

      <Section icon={<Printer className="h-4 w-4" />} title="Reports & printing MVP" description="Print-friendly operational documents. PDF service integration can be added later.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>Print current workspace</Button>
          <Badge variant="outline">Requisition slip</Badge>
          <Badge variant="outline">Lab report</Badge>
          <Badge variant="outline">Radiology report</Badge>
          <Badge variant="outline">Invoice / receipt</Badge>
          <Badge variant="outline">QR verification placeholder</Badge>
        </div>
      </Section>

      <Section icon={<ShieldCheck className="h-4 w-4" />} title="Audit log & security" description="Tenant-scoped audit visibility for compliance and support.">
        <DataList rows={data.audit_events ?? []} columns={["timestamp", "user_name", "role", "action", "entity_type", "entity_id"]} />
      </Section>

      <Section icon={<Rocket className="h-4 w-4" />} title="Phase 5 SaaS commercial readiness" description="Plans, module entitlements, usage counters, branding, data import/export, backup, monitoring, and support scaffolding.">
        <DataList rows={data.plans ?? []} columns={["code", "name", "monthly_price", "user_limit", "patient_limit", "investigation_limit", "storage_gb"]} />
      </Section>
    </div>
  );
}

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function Metric({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectBox({ label, value, values, labels = {}, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {values.map((item) => <SelectItem key={item} value={item}>{labels[item] ?? item}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function DataList({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground rounded-md border p-3">No records yet.</div>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
          <tr>{columns.map((column) => <th key={column} className="text-left px-3 py-2 whitespace-nowrap">{column.replaceAll("_", " ")}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, index) => (
            <tr key={row.id ?? index} className="border-t">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 max-w-[240px] truncate whitespace-nowrap">
                  {row[column] === null || row[column] === undefined ? "—" : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

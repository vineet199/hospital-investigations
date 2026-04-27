export type Priority = "Routine" | "Urgent" | "Stat";
export type Status = "Ordered" | "Sent to Department" | "In Progress" | "Result Ready" | "Reviewed by Doctor";
export type UserRole =
  | "Platform Admin"
  | "Admin"
  | "Doctor"
  | "Nurse"
  | "Technician"
  | "Department Head"
  | "Pharmacist"
  | "Billing"
  | "Reception";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  status?: string;
  planCode?: string;
}

export interface Patient {
  id: string;
  mrn?: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  ward: string;
  bed: string;
  phone?: string;
  address?: string;
  patientClass?: string;
  active?: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  department: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string;
  doctorId?: string;
}

export interface TimelineEvent {
  stage: Status;
  timestamp: string;
  actor: string;
}

export interface Investigation {
  id: string;
  patientId: string;
  orderedByDoctorId: string;
  type: string;
  notes: string;
  priority: Priority;
  departmentId: string;
  technician?: string;
  status: Status;
  resultNotes?: string;
  timeline: TimelineEvent[];
}

export interface AppState {
  patients: Record<string, Patient>;
  doctors: Record<string, Doctor>;
  departments: Record<string, Department>;
  investigations: Record<string, Investigation>;
  currentDoctorId: string;
}

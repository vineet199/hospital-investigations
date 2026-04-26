import { formatDistanceToNow, format } from "date-fns";
import type { Status } from "@/store/types";

export const STATUS_ORDER: Status[] = [
  "Ordered",
  "Sent to Department",
  "In Progress",
  "Result Ready",
  "Reviewed by Doctor",
];

export function statusIndex(s: Status): number {
  return STATUS_ORDER.indexOf(s);
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function fullTime(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export const TECHNICIAN_POOL: Record<string, string[]> = {
  "DEP-1": ["Tech R. Khan", "Tech M. Rivera"],
  "DEP-2": ["Tech E. Davis", "Tech S. Park"],
  "DEP-3": ["Tech A. Smith", "Tech G. Wilson", "Tech D. Brown"],
  "DEP-4": ["Tech B. Jones", "Tech F. Miller"],
  "DEP-5": ["Tech L. Nguyen", "Tech O. Adeyemi"],
  "DEP-6": ["Tech C. Williams", "Tech H. Kapoor"],
};

export function pickTechnician(departmentId: string): string {
  const pool = TECHNICIAN_POOL[departmentId] ?? ["Tech On Duty"];
  return pool[Math.floor(Math.random() * pool.length)] ?? "Tech On Duty";
}

export const INVESTIGATION_TYPES = [
  "Blood Test",
  "X-Ray",
  "ECG",
  "MRI",
  "Urine Culture",
  "CT Scan",
  "Ultrasound",
  "Lipid Panel",
] as const;

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValue] = trimmed.replace(/^export\s+/, "").split("=");
    const key = rawKey.trim();
    const value = rawValue
      .join("=")
      .trim()
      .replace(/\s+#.*$/, "")
      .replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, "");
  const url = new URL(trimmed);

  // If someone pastes a Dashboard URL like
  // https://supabase.com/dashboard/project/abcdefghijklmnopqrst/settings/api,
  // derive the public project API URL from the project ref.
  if (url.hostname === "supabase.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const projectIndex = parts.indexOf("project");
    const projectRef = projectIndex >= 0 ? parts[projectIndex + 1] : undefined;
    if (projectRef) return `https://${projectRef}.supabase.co`;
  }

  // Supabase clients expect the project origin only. Strip accidental
  // endpoint paths like /rest/v1 or /auth/v1 that are often copied from docs.
  return url.origin;
}

let supabaseUrl;
try {
  supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL);
} catch (error) {
  console.error("Invalid SUPABASE_URL/VITE_SUPABASE_URL. Use your project URL, e.g. https://your-project-ref.supabase.co");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See SUPABASE_SETUP.md.",
  );
  process.exit(1);
}

if (supabaseUrl !== (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)) {
  console.log(`Using normalized Supabase URL: ${supabaseUrl}`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const demoUsers = [
  ["doctor@city-general.demo", "Dr. Sarah Chen"],
  ["nurse@city-general.demo", "Nurse Maria Gomez"],
  ["lab@city-general.demo", "Pathology Technician"],
  ["radiology@city-general.demo", "Radiology Technician"],
  ["admin@city-general.demo", "City General Admin"],
  ["doctor@sunrise.demo", "Dr. Anika Rao"],
  ["nurse@sunrise.demo", "Nurse Omar Ali"],
  ["lab@sunrise.demo", "Sunrise Lab Technician"],
  ["admin@sunrise.demo", "Sunrise Admin"],
];

for (const [email, name] of demoUsers) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: "demo123",
    email_confirm: true,
    user_metadata: { name },
  });

  if (error && !/already|registered|exists/i.test(error.message)) {
    throw new Error(`Unable to create ${email}: ${error.message}`);
  }

  console.log(error ? `Skipped existing user ${email}` : `Created ${email}`);
}

const { error } = await admin.rpc("link_demo_memberships");
if (error) {
  throw new Error(
    `Unable to link demo memberships: ${error.message}. Make sure supabase/migrations/001_multitenant_supabase.sql has been applied first.`,
  );
}

console.log("Demo memberships linked. You can now sign in with password demo123.");

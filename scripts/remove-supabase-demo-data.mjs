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
  if (url.hostname === "supabase.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const projectIndex = parts.indexOf("project");
    const projectRef = projectIndex >= 0 ? parts[projectIndex + 1] : undefined;
    if (projectRef) return `https://${projectRef}.supabase.co`;
  }
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

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to remove demo data without explicit confirmation.");
  console.error("Run: pnpm unseed:supabase:confirm");
  process.exit(1);
}

if (process.env.SUPABASE_ENV === "production" && process.env.CONFIRM_PRODUCTION_UNSEED !== "remove-demo-data") {
  console.error("Refusing to run demo cleanup against SUPABASE_ENV=production without CONFIRM_PRODUCTION_UNSEED=remove-demo-data.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const demoTenantSlugs = ["city-general", "sunrise-medical"];
const demoEmails = [
  "platform@hims-saas.demo",
  "doctor@city-general.demo",
  "nurse@city-general.demo",
  "lab@city-general.demo",
  "radiology@city-general.demo",
  "pharmacist@city-general.demo",
  "admin@city-general.demo",
  "doctor@sunrise.demo",
  "nurse@sunrise.demo",
  "lab@sunrise.demo",
  "pharmacist@sunrise.demo",
  "admin@sunrise.demo",
];

console.log(`Removing demo tenants: ${demoTenantSlugs.join(", ")}`);
const { error: platformError } = await admin.from("platform_admins").delete().in("email", demoEmails);
if (platformError && !/does not exist|schema cache|relation .*platform_admins/i.test(platformError.message)) {
  throw new Error(`Unable to remove demo platform admins: ${platformError.message}`);
}

const { error: tenantError } = await admin.from("tenants").delete().in("slug", demoTenantSlugs);
if (tenantError) throw new Error(`Unable to remove demo tenants: ${tenantError.message}`);

console.log("Removing demo Supabase Auth users...");
const { data, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw new Error(`Unable to list users: ${listError.message}`);

for (const user of data.users) {
  const email = user.email?.toLowerCase();
  if (!email || !demoEmails.includes(email)) continue;
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Unable to delete ${email}: ${error.message}`);
  console.log(`Deleted ${email}`);
}

console.log("Demo seed data removed. Schema, plans, and non-demo tenants were left intact.");

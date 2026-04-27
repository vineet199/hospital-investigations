import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const includeRoots = [
  ".env.example",
  "README.md",
  "SUPABASE_SETUP.md",
  "package.json",
  "scripts",
  "src",
  "supabase",
  "public",
];
const ignored = new Set(["node_modules", ".git", "dist", "data", "pnpm-lock.yaml"]);
const allowListedFiles = new Set([
  "scripts/security-check.mjs",
  "scripts/seed-supabase-demo-users.mjs",
  "scripts/remove-supabase-demo-data.mjs",
  "src/lib/supabase-url.test.ts",
]);

const suspiciousPatterns = [
  { name: "JWT-like token", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "Supabase service role exposed through Vite/public env", regex: /VITE_[A-Z0-9_]*SERVICE_ROLE|SERVICE_ROLE[A-Z0-9_]*=.*VITE_/gi },
  { name: "Hard-coded local Supabase project ref outside tests/tools", regex: /peqfaiwioohgrsevoqju/g },
];

function listFiles(target) {
  const abs = path.join(root, target);
  const stat = statSync(abs);
  if (stat.isFile()) return [abs];
  const entries = [];
  for (const name of readdirSync(abs)) {
    if (ignored.has(name)) continue;
    const child = path.join(abs, name);
    const childStat = statSync(child);
    if (childStat.isDirectory()) entries.push(...listFiles(path.relative(root, child)));
    else entries.push(child);
  }
  return entries;
}

const findings = [];
for (const target of includeRoots) {
  let files = [];
  try {
    files = listFiles(target);
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = path.relative(root, file);
    if (/\.(png|jpg|jpeg|svg|ico|sqlite|db|lock)$/i.test(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const pattern of suspiciousPatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(text) && !allowListedFiles.has(rel)) findings.push(`${rel}: ${pattern.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secret/security findings:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Security check passed: no obvious committed secrets or unsafe public service-role references found.");

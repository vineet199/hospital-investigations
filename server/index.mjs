import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const dbPath = process.env.DB_PATH ?? path.join(dataDir, "hospital.sqlite");
const apiPort = Number(process.env.API_PORT ?? process.env.PORT ?? "4173");

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const STATUS_ORDER = [
  "Ordered",
  "Sent to Department",
  "In Progress",
  "Result Ready",
  "Reviewed by Doctor",
];

const TECHNICIAN_POOL = {
  "DEP-1": ["Tech R. Khan", "Tech M. Rivera"],
  "DEP-2": ["Tech E. Davis", "Tech S. Park"],
  "DEP-3": ["Tech A. Smith", "Tech G. Wilson", "Tech D. Brown"],
  "DEP-4": ["Tech B. Jones", "Tech F. Miller"],
  "DEP-5": ["Tech L. Nguyen", "Tech O. Adeyemi"],
  "DEP-6": ["Tech C. Williams", "Tech H. Kapoor"],
};

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function execSql(statement) {
  return execFileSync("sqlite3", [dbPath, statement], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
}

function querySql(statement) {
  const output = execFileSync("sqlite3", ["-json", dbPath, statement], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function pickTechnician(departmentId) {
  const pool = TECHNICIAN_POOL[departmentId] ?? ["Tech On Duty"];
  return pool[Math.floor(Math.random() * pool.length)] ?? "Tech On Duty";
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours, minutes = 0) {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

function schema() {
  execSql(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS doctors (id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  mrn TEXT UNIQUE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  ward TEXT NOT NULL,
  bed TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department_id TEXT,
  doctor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  ordered_by_doctor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL,
  department_id TEXT NOT NULL,
  technician TEXT,
  status TEXT NOT NULL,
  result_notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  details_json TEXT NOT NULL
);
`);
}

function seedIfNeeded() {
  const seeded = querySql("SELECT value FROM settings WHERE key = 'seeded'")[0];
  if (seeded?.value === "true") return;

  const now = new Date().toISOString();
  const users = [
    ["U-ADMIN", "admin@hospital.local", "Hospital Admin", "Admin", null, null],
    ["U-DOC-101", "doctor@hospital.local", "Dr. Sarah Chen", "Doctor", null, "D-101"],
    ["U-NURSE", "nurse@hospital.local", "Nurse Maria Gomez", "Nurse", null, null],
    ["U-LAB", "lab@hospital.local", "Pathology Technician", "Technician", "DEP-3", null],
    ["U-RAD", "radiology@hospital.local", "Radiology Technician", "Technician", "DEP-4", null],
  ];

  const statements = [
    "BEGIN TRANSACTION;",
    ["DEP-1", "Pharmacy"],
    ["DEP-2", "X-Ray Lab"],
    ["DEP-3", "Pathology Lab"],
    ["DEP-4", "Radiology"],
    ["DEP-5", "Blood Bank"],
    ["DEP-6", "Cardiology"],
  ].map((item) =>
    typeof item === "string"
      ? item
      : `INSERT INTO departments (id, name) VALUES (${sql(item[0])}, ${sql(item[1])});`,
  );

  statements.push(
    `INSERT INTO doctors (id, name, department) VALUES ('D-101', 'Dr. Sarah Chen', 'Internal Medicine');`,
    `INSERT INTO doctors (id, name, department) VALUES ('D-102', 'Dr. James Wilson', 'Cardiology');`,
    `INSERT INTO doctors (id, name, department) VALUES ('D-103', 'Dr. Priya Patel', 'General Surgery');`,
    `INSERT INTO patients (id, mrn, name, age, gender, ward, bed) VALUES ('P-1042', 'MRN-0001042', 'Robert Miller', 64, 'Male', 'Ward 3B', 'Bed 12');`,
    `INSERT INTO patients (id, mrn, name, age, gender, ward, bed) VALUES ('P-1043', 'MRN-0001043', 'Aisha Sharma', 42, 'Female', 'Ward 2A', 'Bed 04');`,
    `INSERT INTO patients (id, mrn, name, age, gender, ward, bed) VALUES ('P-1044', 'MRN-0001044', 'Marcus Johnson', 28, 'Male', 'ER', 'Bed 01');`,
    `INSERT INTO patients (id, mrn, name, age, gender, ward, bed) VALUES ('P-1045', 'MRN-0001045', 'Eleanor Davis', 82, 'Female', 'ICU', 'Bed 08');`,
    `INSERT INTO patients (id, mrn, name, age, gender, ward, bed) VALUES ('P-1046', 'MRN-0001046', 'David Kim', 55, 'Male', 'Ward 4C', 'Bed 22');`,
  );

  for (const [id, email, name, role, departmentId, doctorId] of users) {
    statements.push(
      `INSERT INTO users (id, email, password_hash, name, role, department_id, doctor_id, created_at) VALUES (${sql(id)}, ${sql(email)}, ${sql(hashPassword("demo123"))}, ${sql(name)}, ${sql(role)}, ${sql(departmentId)}, ${sql(doctorId)}, ${sql(now)});`,
    );
  }

  const investigations = [
    ["INV-001", "P-1042", "D-101", "Lipid Panel", "Routine check, fasting 12h", "Routine", "DEP-3", "Tech A. Smith", "Reviewed by Doctor", "LDL elevated at 160 mg/dL. HDL 45 mg/dL. Triglycerides 150 mg/dL.", [["Ordered", hoursAgo(24), "Dr. Sarah Chen"], ["Sent to Department", hoursAgo(23, 45), "Dr. Sarah Chen"], ["In Progress", hoursAgo(22), "Tech A. Smith"], ["Result Ready", hoursAgo(20), "Tech A. Smith"], ["Reviewed by Doctor", hoursAgo(2), "Dr. Sarah Chen"]]],
    ["INV-002", "P-1044", "D-103", "CT Scan", "Rule out appendicitis", "Stat", "DEP-4", "Tech B. Jones", "Result Ready", "No evidence of acute appendicitis. Mild thickening of terminal ileum.", [["Ordered", hoursAgo(3), "Dr. Priya Patel"], ["Sent to Department", hoursAgo(2, 55), "Dr. Priya Patel"], ["In Progress", hoursAgo(2, 40), "Tech B. Jones"], ["Result Ready", hoursAgo(0, 15), "Tech B. Jones"]]],
    ["INV-003", "P-1045", "D-102", "ECG", "Patient reporting chest pain", "Stat", "DEP-6", "Tech C. Williams", "In Progress", null, [["Ordered", hoursAgo(1), "Dr. James Wilson"], ["Sent to Department", hoursAgo(0, 50), "Dr. James Wilson"], ["In Progress", hoursAgo(0, 20), "Tech C. Williams"]]],
    ["INV-004", "P-1043", "D-101", "Urine Culture", "Suspected UTI", "Routine", "DEP-3", "Tech D. Brown", "Sent to Department", null, [["Ordered", hoursAgo(5), "Dr. Sarah Chen"], ["Sent to Department", hoursAgo(4, 30), "Dr. Sarah Chen"]]],
    ["INV-005", "P-1046", "D-102", "Blood Test", "CBC and BMP", "Urgent", "DEP-3", null, "Ordered", null, [["Ordered", hoursAgo(0, 5), "Dr. James Wilson"]]],
    ["INV-006", "P-1042", "D-101", "X-Ray", "Chest AP/Lat", "Routine", "DEP-2", "Tech E. Davis", "Reviewed by Doctor", "Clear lungs. No acute cardiopulmonary process.", [["Ordered", hoursAgo(48), "Dr. Sarah Chen"], ["Sent to Department", hoursAgo(47), "Dr. Sarah Chen"], ["In Progress", hoursAgo(46), "Tech E. Davis"], ["Result Ready", hoursAgo(45), "Tech E. Davis"], ["Reviewed by Doctor", hoursAgo(24), "Dr. Sarah Chen"]]],
    ["INV-007", "P-1044", "D-103", "Ultrasound", "Abdominal right lower quadrant", "Stat", "DEP-4", "Tech F. Miller", "In Progress", null, [["Ordered", hoursAgo(4), "Dr. Priya Patel"], ["Sent to Department", hoursAgo(3, 50), "Dr. Priya Patel"], ["In Progress", hoursAgo(3, 30), "Tech F. Miller"]]],
    ["INV-008", "P-1045", "D-102", "Blood Test", "Cardiac enzymes (Troponin)", "Stat", "DEP-3", "Tech G. Wilson", "Result Ready", "Troponin I < 0.04 ng/mL (Normal)", [["Ordered", hoursAgo(1, 30), "Dr. James Wilson"], ["Sent to Department", hoursAgo(1, 20), "Dr. James Wilson"], ["In Progress", hoursAgo(1, 10), "Tech G. Wilson"], ["Result Ready", hoursAgo(0, 5), "Tech G. Wilson"]]],
  ];

  for (const inv of investigations) {
    const [id, patientId, doctorId, type, notes, priority, departmentId, technician, status, resultNotes, timeline] = inv;
    statements.push(
      `INSERT INTO investigations (id, patient_id, ordered_by_doctor_id, type, notes, priority, department_id, technician, status, result_notes, created_at) VALUES (${sql(id)}, ${sql(patientId)}, ${sql(doctorId)}, ${sql(type)}, ${sql(notes)}, ${sql(priority)}, ${sql(departmentId)}, ${sql(technician)}, ${sql(status)}, ${sql(resultNotes)}, ${sql(timeline[0][1])});`,
    );
    for (const [stage, timestamp, actor] of timeline) {
      statements.push(
        `INSERT INTO timeline_events (id, investigation_id, stage, timestamp, actor) VALUES (${sql(`EVT-${crypto.randomUUID()}`)}, ${sql(id)}, ${sql(stage)}, ${sql(timestamp)}, ${sql(actor)});`,
      );
    }
  }

  statements.push(
    `INSERT INTO settings (key, value) VALUES ('seeded', 'true');`,
    "COMMIT;",
  );
  execSql(statements.join("\n"));
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    departmentId: row.department_id ?? undefined,
    doctorId: row.doctor_id ?? undefined,
  };
}

function recordFrom(rows, map) {
  return Object.fromEntries(rows.map((row) => [row.id, map(row)]));
}

function getState(user) {
  const departments = querySql("SELECT id, name FROM departments ORDER BY name;");
  const doctors = querySql("SELECT id, name, department FROM doctors ORDER BY name;");
  const patients = querySql("SELECT id, mrn, name, age, gender, ward, bed FROM patients ORDER BY name;");
  const investigations = querySql("SELECT * FROM investigations ORDER BY created_at DESC;");
  const events = querySql("SELECT investigation_id, stage, timestamp, actor FROM timeline_events ORDER BY timestamp ASC;");
  const timelineByInvestigation = new Map();
  for (const event of events) {
    const timeline = timelineByInvestigation.get(event.investigation_id) ?? [];
    timeline.push({ stage: event.stage, timestamp: event.timestamp, actor: event.actor });
    timelineByInvestigation.set(event.investigation_id, timeline);
  }

  return {
    patients: recordFrom(patients, (p) => ({
      id: p.id,
      mrn: p.mrn,
      name: p.name,
      age: Number(p.age),
      gender: p.gender,
      ward: p.ward,
      bed: p.bed,
    })),
    doctors: recordFrom(doctors, (d) => ({ id: d.id, name: d.name, department: d.department })),
    departments: recordFrom(departments, (d) => ({ id: d.id, name: d.name })),
    investigations: recordFrom(investigations, (i) => ({
      id: i.id,
      patientId: i.patient_id,
      orderedByDoctorId: i.ordered_by_doctor_id,
      type: i.type,
      notes: i.notes ?? "",
      priority: i.priority,
      departmentId: i.department_id,
      technician: i.technician ?? undefined,
      status: i.status,
      resultNotes: i.result_notes ?? undefined,
      timeline: timelineByInvestigation.get(i.id) ?? [],
    })),
    currentDoctorId: user?.doctorId ?? "D-101",
  };
}

function audit(user, action, entityType, entityId, details = {}) {
  execSql(
    `INSERT INTO audit_events (id, user_id, user_name, role, action, entity_type, entity_id, timestamp, details_json) VALUES (${sql(`AUD-${crypto.randomUUID()}`)}, ${sql(user?.id)}, ${sql(user?.name ?? "System")}, ${sql(user?.role ?? "System")}, ${sql(action)}, ${sql(entityType)}, ${sql(entityId)}, ${sql(new Date().toISOString())}, ${sql(JSON.stringify(details))});`,
  );
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function getUserFromRequest(req) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const rows = querySql(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ${sql(token)} AND s.expires_at > ${sql(new Date().toISOString())} LIMIT 1;`,
  );
  return rowToUser(rows[0]);
}

function getInvestigation(id) {
  return querySql(`SELECT * FROM investigations WHERE id = ${sql(id)} LIMIT 1;`)[0];
}

function canCreate(user) {
  return ["Admin", "Doctor"].includes(user.role);
}

function canSend(user) {
  return ["Admin", "Doctor", "Nurse"].includes(user.role);
}

function canReview(user) {
  return ["Admin", "Doctor"].includes(user.role);
}

function canWorkDepartment(user, departmentId) {
  return user.role === "Admin" || (["Technician", "Department Head"].includes(user.role) && user.departmentId === departmentId);
}

function mutationResponse(res, user) {
  sendJson(res, 200, { state: getState(user) });
}

async function handleAuth(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const row = querySql(`SELECT * FROM users WHERE lower(email) = ${sql(email)} LIMIT 1;`)[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      return sendError(res, 401, "Invalid email or password.");
    }
    const token = crypto.randomBytes(32).toString("hex");
    const createdAt = new Date();
    execSql(
      `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (${sql(token)}, ${sql(row.id)}, ${sql(createdAt.toISOString())}, ${sql(addHours(createdAt, 12))});`,
    );
    const user = rowToUser(row);
    audit(user, "login", "user", user.id);
    return sendJson(res, 200, { token, user, state: getState(user) });
  }

  const user = getUserFromRequest(req);
  if (!user) return sendError(res, 401, "Authentication required.");

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    return sendJson(res, 200, { user, state: getState(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";
    if (token) execSql(`DELETE FROM sessions WHERE token = ${sql(token)};`);
    audit(user, "logout", "user", user.id);
    return sendJson(res, 200, { ok: true });
  }

  return null;
}

async function handleApi(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  if (url.pathname.startsWith("/api/auth/")) {
    const handled = await handleAuth(req, res, url);
    if (handled !== null) return;
  }

  const user = getUserFromRequest(req);
  if (!user) return sendError(res, 401, "Authentication required.");

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, database: dbPath });
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    return sendJson(res, 200, { state: getState(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/investigations") {
    if (!canCreate(user)) return sendError(res, 403, "Only doctors and admins can create investigation orders.");
    const body = await readJson(req);
    const investigations = Array.isArray(body.investigations) ? body.investigations : [];
    if (investigations.length === 0) return sendError(res, 400, "At least one investigation is required.");

    const actor = user.name;
    const now = new Date().toISOString();
    const statements = ["BEGIN TRANSACTION;"];
    for (const [index, inv] of investigations.entries()) {
      const id = `INV-${Date.now()}-${index}`;
      const doctorId = inv.orderedByDoctorId || user.doctorId || "D-101";
      statements.push(
        `INSERT INTO investigations (id, patient_id, ordered_by_doctor_id, type, notes, priority, department_id, technician, status, result_notes, created_at) VALUES (${sql(id)}, ${sql(inv.patientId)}, ${sql(doctorId)}, ${sql(inv.type)}, ${sql(inv.notes ?? "")}, ${sql(inv.priority)}, ${sql(inv.departmentId)}, NULL, 'Ordered', NULL, ${sql(now)});`,
        `INSERT INTO timeline_events (id, investigation_id, stage, timestamp, actor) VALUES (${sql(`EVT-${crypto.randomUUID()}`)}, ${sql(id)}, 'Ordered', ${sql(now)}, ${sql(actor)});`,
      );
    }
    statements.push("COMMIT;");
    execSql(statements.join("\n"));
    audit(user, "create_investigations", "investigation", "bulk", { count: investigations.length });
    return mutationResponse(res, user);
  }

  const sendMatch = url.pathname.match(/^\/api\/investigations\/([^/]+)\/send-to-department$/);
  if (req.method === "POST" && sendMatch) {
    if (!canSend(user)) return sendError(res, 403, "Only doctors, nurses, and admins can dispatch investigations.");
    const id = decodeURIComponent(sendMatch[1]);
    const inv = getInvestigation(id);
    if (!inv) return sendError(res, 404, "Investigation not found.");
    if (inv.status !== "Ordered") return sendError(res, 409, "Only ordered investigations can be sent to a department.");
    const body = await readJson(req);
    const technician = body.technician || pickTechnician(inv.department_id);
    const now = new Date().toISOString();
    execSql(`
BEGIN TRANSACTION;
UPDATE investigations SET status = 'Sent to Department', technician = ${sql(technician)} WHERE id = ${sql(id)};
INSERT INTO timeline_events (id, investigation_id, stage, timestamp, actor) VALUES (${sql(`EVT-${crypto.randomUUID()}`)}, ${sql(id)}, 'Sent to Department', ${sql(now)}, ${sql(user.name)});
COMMIT;`);
    audit(user, "send_to_department", "investigation", id, { technician });
    return mutationResponse(res, user);
  }

  const advanceMatch = url.pathname.match(/^\/api\/investigations\/([^/]+)\/advance$/);
  if (req.method === "POST" && advanceMatch) {
    const id = decodeURIComponent(advanceMatch[1]);
    const inv = getInvestigation(id);
    if (!inv) return sendError(res, 404, "Investigation not found.");
    if (!canWorkDepartment(user, inv.department_id)) return sendError(res, 403, "You can only update work for your assigned department.");
    const body = await readJson(req);
    const nextStatus = String(body.status ?? "");
    if (!["In Progress", "Result Ready"].includes(nextStatus)) return sendError(res, 400, "Invalid status transition.");
    if (nextStatus === "In Progress" && inv.status !== "Sent to Department") return sendError(res, 409, "Only queued investigations can be started.");
    const now = new Date().toISOString();
    execSql(`
BEGIN TRANSACTION;
UPDATE investigations SET status = ${sql(nextStatus)}, technician = COALESCE(technician, ${sql(pickTechnician(inv.department_id))}) WHERE id = ${sql(id)};
INSERT INTO timeline_events (id, investigation_id, stage, timestamp, actor) VALUES (${sql(`EVT-${crypto.randomUUID()}`)}, ${sql(id)}, ${sql(nextStatus)}, ${sql(now)}, ${sql(user.name)});
COMMIT;`);
    audit(user, "advance_status", "investigation", id, { status: nextStatus });
    return mutationResponse(res, user);
  }

  const resultMatch = url.pathname.match(/^\/api\/investigations\/([^/]+)\/result$/);
  if (req.method === "POST" && resultMatch) {
    const id = decodeURIComponent(resultMatch[1]);
    const inv = getInvestigation(id);
    if (!inv) return sendError(res, 404, "Investigation not found.");
    if (!canWorkDepartment(user, inv.department_id)) return sendError(res, 403, "You can only save results for your assigned department.");
    const body = await readJson(req);
    const notes = String(body.notes ?? "").trim();
    if (!notes) return sendError(res, 400, "Result notes are required.");
    const now = new Date().toISOString();
    const addReadyEvent = inv.status !== "Result Ready";
    execSql(`
BEGIN TRANSACTION;
UPDATE investigations SET result_notes = ${sql(notes)}, status = 'Result Ready', technician = COALESCE(technician, ${sql(pickTechnician(inv.department_id))}) WHERE id = ${sql(id)};
${addReadyEvent ? `INSERT INTO timeline_events (id, investigation_id, stage, timestamp, actor) VALUES (${sql(`EVT-${crypto.randomUUID()}`)}, ${sql(id)}, 'Result Ready', ${sql(now)}, ${sql(user.name)});` : ""}
COMMIT;`);
    audit(user, "save_result", "investigation", id);
    return mutationResponse(res, user);
  }

  const reviewMatch = url.pathname.match(/^\/api\/investigations\/([^/]+)\/review$/);
  if (req.method === "POST" && reviewMatch) {
    if (!canReview(user)) return sendError(res, 403, "Only doctors and admins can review results.");
    const id = decodeURIComponent(reviewMatch[1]);
    const inv = getInvestigation(id);
    if (!inv) return sendError(res, 404, "Investigation not found.");
    if (inv.status !== "Result Ready") return sendError(res, 409, "Only result-ready investigations can be reviewed.");
    const now = new Date().toISOString();
    execSql(`
BEGIN TRANSACTION;
UPDATE investigations SET status = 'Reviewed by Doctor' WHERE id = ${sql(id)};
INSERT INTO timeline_events (id, investigation_id, stage, timestamp, actor) VALUES (${sql(`EVT-${crypto.randomUUID()}`)}, ${sql(id)}, 'Reviewed by Doctor', ${sql(now)}, ${sql(user.name)});
COMMIT;`);
    audit(user, "mark_reviewed", "investigation", id);
    return mutationResponse(res, user);
  }

  return sendError(res, 404, "API route not found.");
}

schema();
seedIfNeeded();

const server = http.createServer((req, res) => {
  handleApi(req, res).catch((error) => {
    console.error(error);
    sendError(res, 500, error instanceof Error ? error.message : "Unexpected server error.");
  });
});

server.listen(apiPort, () => {
  console.log(`Hospital API listening on http://localhost:${apiPort}`);
  console.log(`SQLite database: ${dbPath}`);
});
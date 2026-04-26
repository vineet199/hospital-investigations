import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

// Supabase now provides auth + database APIs directly to the Vite client.
// This compatibility wrapper keeps `node scripts/dev.mjs` working without
// starting the legacy SQLite API server.
const children = [
  spawn(isWindows ? "pnpm.cmd" : "pnpm", ["dev:client"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.PORT ?? "5173",
    },
  }),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
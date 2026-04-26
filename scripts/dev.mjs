import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

const children = [
  spawn("node", ["server/index.mjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      API_PORT: process.env.API_PORT ?? "4173",
    },
  }),
  spawn(isWindows ? "pnpm.cmd" : "pnpm", ["dev:client"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.PORT ?? "5173",
      API_PORT: process.env.API_PORT ?? "4173",
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
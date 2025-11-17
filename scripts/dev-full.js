"use strict";

const path = require("path");
const { spawn, execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const sharedEnv = {
  ...process.env,
  DATABASE_URL: "sqlite:///./users.db",
};

const services = [
  {
    name: "backend",
    label: "FastAPI",
    command: "npm",
    args: ["run", "backend"],
    summary: "API + reminders",
    url: "http://localhost:8000",
  },
  {
    name: "mcp",
    label: "MCP",
    command: "npm",
    args: ["run", "mcp:plans-habits-server"],
    summary: "plans-habits-server (MCP worker)",
  },
  {
    name: "web",
    label: "Next.js",
    command: "npm",
    args: ["run", "dev"],
    summary: "Gray workspace UI",
    url: "http://gray.localhost:3000",
  },
];

const running = new Map();
let shuttingDown = false;
let exitCode = 0;

function killStaleProcesses() {
  if (process.platform === "win32") {
    return;
  }

  const patterns = [
    // Backend (FastAPI / uvicorn)
    "cd backend && python3 start.py",
    "python3 start.py",
    "uvicorn main:app",
    // Next.js dev server
    "next dev",
    "next-server (v16.0.0)",
  ];

  console.log("Cleaning up any stale Gray dev processes...");
  for (const pattern of patterns) {
    try {
      execSync(`pkill -f "${pattern}"`, { stdio: "ignore" });
    } catch {
      // Ignore if no processes match; pkill exits non-zero
    }
  }
}

console.log("──────────────────────────────────────────────────────────────");
console.log("Starting Gray dev stack (npm run dev:full)");
console.log(`DATABASE_URL=${sharedEnv.DATABASE_URL}`);
console.log("");
console.log("Services:");
services.forEach((service) => {
  const parts = [];
  if (service.summary) {
    parts.push(service.summary);
  }
  if (service.url) {
    parts.push(service.url);
  }
  console.log(
    `  - ${service.name}: ${parts.join(" · ") || "no description"} (${service.command} ${service.args.join(
      " "
    )})`
  );
});
console.log("──────────────────────────────────────────────────────────────");

// Ensure we don't have leftover dev processes from a previous run
killStaleProcesses();

services.forEach((service) => startService(service));

process.on("SIGINT", () => terminate("SIGINT"));
process.on("SIGTERM", () => terminate("SIGTERM"));

function startService(service) {
  console.log(
    `[orchestrator] launching ${service.name} (${service.command} ${service.args.join(
      " "
    )})`
  );

  const child = spawn(service.command, service.args, {
    cwd: rootDir,
    env: sharedEnv,
    stdio: "inherit",
    // On POSIX, run each service in its own process group so we can
    // terminate the entire tree (npm, node, uvicorn, next, etc.).
    detached: process.platform !== "win32",
  });

  running.set(service.name, child);

  child.on("exit", (code, signal) => {
    running.delete(service.name);
    if (code !== null && code !== 0 && exitCode === 0) {
      exitCode = code;
    }

    if (code === null && signal && exitCode === 0) {
      exitCode = 1;
    }

    console.log(
      `[orchestrator] ${service.name} exited with ${
        code !== null ? `code ${code}` : `signal ${signal}`
      }`
    );

    if (!shuttingDown && code !== null && code !== 0) {
      terminate("service failure");
    }

    if (running.size === 0) {
      process.exit(exitCode);
    }
  });
}

function terminate(reason = "terminate") {
  if (shuttingDown) {
    // Second Ctrl-C while shutting down: force exit.
    console.log("Force exiting dev orchestrator");
    process.exit(1);
  }

  shuttingDown = true;
  console.log(`Stopping services (${reason})`);

  for (const [name, child] of running.entries()) {
    if (!child.killed) {
      console.log(`[orchestrator] sending SIGTERM to ${name}`);
      try {
        if (process.platform === "win32") {
          child.kill("SIGTERM");
        } else {
          // Kill the whole process group started by this child
          process.kill(-child.pid, "SIGTERM");
        }
      } catch (error) {
        console.warn(
          `[orchestrator] failed to terminate ${name}:`,
          error.message || error
        );
      }
    }
  }
}

import { spawn } from "node:child_process";
import { createServer } from "node:net";

export const DEFAULT_TAURI_DEV_PORT = 1432;
const LOCALHOST = "127.0.0.1";
const MAX_PORT_PROBES = 80;

export function parsePort(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return fallback;
  }
  return port;
}

export function isPortAvailable(port, host = LOCALHOST) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen({ host, port });
  });
}

export async function findAvailableDevPort({
  preferredPort = DEFAULT_TAURI_DEV_PORT,
  maxPortProbes = MAX_PORT_PROBES,
} = {}) {
  for (let offset = 0; offset < maxPortProbes; offset += 1) {
    const port = preferredPort + offset;
    if (port > 65535) {
      break;
    }
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(
    `No available local dev port found from ${preferredPort} across ${maxPortProbes} probes.`,
  );
}

export function buildTauriDevArgs(extraArgs, devUrl) {
  return [
    "exec",
    "tauri",
    "dev",
    ...extraArgs,
    "--config",
    JSON.stringify({
      build: {
        devUrl,
      },
    }),
  ];
}

async function main() {
  const preferredPort = parsePort(
    process.env.AGENT_MONITOR_DEV_PORT,
    DEFAULT_TAURI_DEV_PORT,
  );
  const port = await findAvailableDevPort({ preferredPort });
  const devUrl = `http://localhost:${port}`;
  const args = buildTauriDevArgs(process.argv.slice(2), devUrl);

  console.log(`[tauri:dev] using frontend dev server ${devUrl}`);

  const child = spawn("pnpm", args, {
    env: {
      ...process.env,
      AGENT_MONITOR_DEV_PORT: String(port),
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

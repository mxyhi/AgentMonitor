import type { AppServerEvent, DebugEntry } from "../types";
import { getAppServerParams, getAppServerRawMethod } from "./appServerEvents";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function slugifyLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function serializeError(error: Error): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };
  if (error.stack) {
    payload.stack = error.stack;
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    payload.cause = cause instanceof Error ? serializeError(cause) : cause;
  }
  return payload;
}

function serializeUnknownError(error: unknown): unknown {
  if (error instanceof Error) {
    return serializeError(error);
  }
  if (isRecord(error)) {
    return error;
  }
  return String(error);
}

function readStringField(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function resolveAppServerErrorMessage(params: Record<string, unknown>): string {
  const error = params.error;
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === "string") {
      return message;
    }
  }
  if (typeof error === "string") {
    return error;
  }
  const message = params.message;
  return typeof message === "string" ? message : "";
}

function buildAppServerErrorPayload(event: AppServerEvent): Record<string, unknown> {
  const params = getAppServerParams(event);
  return {
    workspaceId: event.workspace_id,
    threadId: readStringField(params, ["threadId", "thread_id"]),
    turnId: readStringField(params, ["turnId", "turn_id"]),
    willRetry: Boolean(params.willRetry ?? params.will_retry),
    message: resolveAppServerErrorMessage(params),
    error: params.error ?? null,
    event,
  };
}

function isAppServerErrorMethod(method: string): boolean {
  return method === "error" || method.endsWith("/error");
}

export function buildErrorDebugEntry(label: string, error: unknown): DebugEntry {
  const timestamp = Date.now();
  const payload = serializeUnknownError(error);
  const slug = slugifyLabel(label);
  return {
    id: `${timestamp}-${slug || "error"}`,
    timestamp,
    source: "error",
    label,
    payload,
  };
}

export function buildAppServerEventDebugEntry(
  event: AppServerEvent,
  timestamp = Date.now(),
): DebugEntry {
  const method = getAppServerRawMethod(event) ?? "";
  const label = method || "event";
  const slug = slugifyLabel(label);
  const source = isAppServerErrorMethod(method)
    ? "error"
    : method === "codex/stderr"
      ? "stderr"
      : "event";
  return {
    id: `${timestamp}-server-${slug || "event"}`,
    timestamp,
    source,
    label,
    payload: source === "error" ? buildAppServerErrorPayload(event) : event,
  };
}

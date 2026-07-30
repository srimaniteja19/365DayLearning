import type { AppSnapshot } from "@/lib/types";

export type CloudPullResult =
  | { ok: true; snapshot: AppSnapshot | null; updatedAt: string | null }
  | { ok: false; error: string };

export type CloudPushResult =
  | { ok: true; updatedAt: string }
  | {
      ok: false;
      error: string;
      conflict?: boolean;
      snapshot?: AppSnapshot | null;
      updatedAt?: string | null;
    };

/** Session-only — last successful pull/push from this browser tab. */
let lastSyncedAt: number | null = null;

export async function pullCloudSnapshot(): Promise<CloudPullResult> {
  try {
    const res = await fetch("/api/state", { method: "GET" });
    if (res.status === 401) return { ok: false, error: "unauthenticated" };
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.error || `Request failed (${res.status})` };
    }
    const data = (await res.json()) as { snapshot: AppSnapshot | null; updatedAt: string | null };
    recordSyncNow();
    return { ok: true, snapshot: data.snapshot, updatedAt: data.updatedAt };
  } catch {
    return { ok: false, error: "Network error while loading cloud data." };
  }
}

export async function pushCloudSnapshot(
  snapshot: AppSnapshot,
  baseUpdatedAt: string | null = null,
  opts?: { keepalive?: boolean },
): Promise<CloudPushResult> {
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, baseUpdatedAt }),
      keepalive: opts?.keepalive === true,
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      message?: string;
      updatedAt?: string;
      snapshot?: AppSnapshot | null;
    } | null;

    if (res.status === 409) {
      return {
        ok: false,
        conflict: true,
        error: data?.message || data?.error || "Cloud data changed on another device.",
        snapshot: data?.snapshot ?? null,
        updatedAt: data?.updatedAt ?? null,
      };
    }

    if (!res.ok) {
      return { ok: false, error: data?.error || `Request failed (${res.status})` };
    }

    const updatedAt = data?.updatedAt || new Date().toISOString();
    recordSyncNow();
    return { ok: true, updatedAt };
  } catch {
    return { ok: false, error: "Network error while saving cloud data." };
  }
}

function recordSyncNow(): void {
  lastSyncedAt = Date.now();
}

export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}

export function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 15_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "moments ago";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

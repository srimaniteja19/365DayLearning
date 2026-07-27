import type { AppSnapshot } from "@/lib/types";

export type CloudPullResult =
  | { ok: true; snapshot: AppSnapshot | null; updatedAt: string | null }
  | { ok: false; error: string };

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

export async function pushCloudSnapshot(snapshot: AppSnapshot): Promise<boolean> {
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    if (res.ok) recordSyncNow();
    return res.ok;
  } catch {
    return false;
  }
}

const LAST_SYNC_KEY = "dualtrack:lastSync";

/**
 * Sync timestamps live in raw localStorage (not the synced snapshot itself)
 * since "last synced from this device" is inherently per-browser-profile —
 * exactly what localStorage already gives us for free.
 */
function recordSyncNow(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    // best-effort only
  }
}

export function getLastSyncedAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
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

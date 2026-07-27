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
    return res.ok;
  } catch {
    return false;
  }
}

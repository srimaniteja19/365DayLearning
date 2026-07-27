"use client";

import React, { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { formatAgo, getLastSyncedAt } from "@/lib/cloudSync";

type Mode = "signin" | "signup";

function useLastSyncedLabel(active: boolean): string | null {
  const [ts, setTs] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const tick = () => setTs(getLastSyncedAt());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [active]);

  return ts ? formatAgo(ts) : null;
}

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedLabel = useLastSyncedLabel(!!session?.user);

  if (status === "loading") {
    return (
      <div className="settings-panel">
        <p className="panel-copy">Checking your session…</p>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="settings-panel">
        <p className="panel-copy">
          Signed in as <strong>{session.user.email}</strong>. Your plans, progress, notes, and
          journal entries sync to this account from any device.
        </p>
        <div className="sync-status-row">
          <Icon.Cloud size={13} />
          <span>
            Last synced from this device: <strong>{lastSyncedLabel || "not yet"}</strong>
          </span>
        </div>
        <div className="panel-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={async () => {
              await signOut({ redirect: false });
              onClose();
            }}
          >
            Sign out
          </button>
          <button className="secondary-btn" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error || "Could not create account.");
          setBusy(false);
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Incorrect email or password.");
        setBusy(false);
        return;
      }
      onClose();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-panel">
      <p className="panel-copy">
        Create a free account to sync your plans, progress, notes, and journal across devices.
        Local mode keeps working fine without one.
      </p>

      <div className="gen-field">
        <div className="seg-row">
          <button
            type="button"
            className={classNames("seg-btn", mode === "signin" && "seg-btn-active")}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={classNames("seg-btn", mode === "signup" && "seg-btn-active")}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Create account
          </button>
        </div>
      </div>

      <form onSubmit={submit}>
        {mode === "signup" && (
          <div className="gen-field">
            <label className="gen-label">Name (optional)</label>
            <input
              className="settings-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div className="gen-field">
          <label className="gen-label">Email</label>
          <input
            className="settings-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="gen-field">
          <label className="gen-label">Password</label>
          <input
            className="settings-input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {mode === "signup" && <div className="gen-hint">At least 8 characters.</div>}
        </div>

        <div className="panel-actions">
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <button className="secondary-btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>

      {error && (
        <div className="settings-test settings-test-err">
          <Icon.X size={14} /> {error}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { AccountSessionSkeleton } from "@/components/Skeleton";
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

export function AccountPanel({
  onClose,
  onAuthenticated,
  onViewPricing,
  defaultMode = "signup",
}: {
  onClose: () => void;
  onAuthenticated?: () => void;
  onViewPricing?: () => void;
  defaultMode?: Mode;
}) {
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedLabel = useLastSyncedLabel(!!session?.user);

  if (status === "loading") {
    return <AccountSessionSkeleton />;
  }

  if (session?.user) {
    return (
      <div className="account-panel">
        <div className="account-signed">
          <div className="account-signed-mark" aria-hidden="true" />
          <div className="account-signed-body">
            <div className="account-signed-label">Signed in</div>
            <div className="account-signed-email">{session.user.email}</div>
            <p className="account-signed-copy">
              Plans, progress, notes, and journal sync to this account from any device.
            </p>
          </div>
        </div>

        <div className="account-sync">
          <Icon.Cloud size={15} />
          <span>
            Last synced from this device: <strong>{lastSyncedLabel || "not yet"}</strong>
          </span>
        </div>

        {onViewPricing && (
          <button type="button" className="account-btn account-btn-plans" onClick={onViewPricing}>
            View plans &amp; usage
          </button>
        )}

        <div className="account-actions">
          <button
            className="account-btn account-btn-ghost"
            type="button"
            onClick={async () => {
              await signOut({ redirect: false });
              onClose();
            }}
          >
            Sign out
          </button>
          <button className="account-btn account-btn-solid" type="button" onClick={onClose}>
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
      (onAuthenticated || onClose)();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-panel">
      <p className="account-lead">
        Create a free account or sign in to run campaigns, Field Kit, and sync progress across
        devices.
      </p>

      <div className="account-tabs" role="tablist" aria-label="Account mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={classNames("account-tab", mode === "signin" && "account-tab-active")}
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={classNames("account-tab", mode === "signup" && "account-tab-active")}
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
        >
          Create account
        </button>
      </div>

      <form className="account-form" onSubmit={submit}>
        {mode === "signup" && (
          <div className="account-field">
            <label className="account-label" htmlFor="account-name">
              Name <span className="account-optional">(optional)</span>
            </label>
            <input
              id="account-name"
              className="account-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div className="account-field">
          <label className="account-label" htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            className="account-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="account-field">
          <label className="account-label" htmlFor="account-password">
            Password
          </label>
          <input
            id="account-password"
            className="account-input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {mode === "signup" && <div className="account-hint">At least 8 characters.</div>}
        </div>

        <div className="account-actions">
          <button className="account-btn account-btn-primary" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <button className="account-btn account-btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>

      {error && (
        <div className="account-error" role="alert">
          <Icon.X size={14} /> {error}
        </div>
      )}
    </div>
  );
}

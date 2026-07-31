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
            Last synced this session: <strong>{lastSyncedLabel || "not yet"}</strong>
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
              await signOut({ callbackUrl: "/" });
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

      <button
        type="button"
        className="account-btn account-btn-google"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            await signIn("google", { callbackUrl: "/dashboard" });
          } catch {
            setError("Could not start Google sign-in.");
            setBusy(false);
          }
        }}
      >
        <GoogleMark />
        Continue with Google
      </button>

      <div className="account-or" role="separator" aria-label="or">
        <span>or</span>
      </div>

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

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

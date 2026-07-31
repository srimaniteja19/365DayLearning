"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AccountPanel } from "@/features/account/AccountPanel";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";

/** Sign-in gate for the marketing page — same modal chrome as the in-app AccountPanel modal. */
export function LandingSignInModal({
  defaultMode,
  onClose,
}: {
  defaultMode: "signin" | "signup";
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>('input, button:not([disabled])')
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={classNames("modal", "modal-account")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-modal-title"
      >
        <div className="modal-head">
          <span className="modal-title" id="landing-modal-title">
            Account &amp; sync
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon.X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <AccountPanel
            onClose={onClose}
            onAuthenticated={() => router.push("/dashboard")}
            defaultMode={defaultMode}
          />
        </div>
      </div>
    </div>
  );
}

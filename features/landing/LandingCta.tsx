"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingSignInModal } from "./LandingSignInModal";

/**
 * Primary/secondary landing CTA. Renders a plain /app link for signed-in
 * visitors (no client fetch needed); opens the sign-in modal otherwise.
 */
export function LandingCta({
  loggedIn,
  label,
  signedInLabel,
  defaultMode = "signup",
  className,
}: {
  loggedIn: boolean;
  label: string;
  signedInLabel?: string;
  defaultMode?: "signin" | "signup";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (loggedIn) {
    return (
      <Link href="/dashboard" className={className}>
        {signedInLabel || label}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <LandingSignInModal defaultMode={defaultMode} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

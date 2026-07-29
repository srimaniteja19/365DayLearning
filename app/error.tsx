"use client";

import { useEffect } from "react";

const wrap: React.CSSProperties = {
  minHeight: "60vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 24,
  textAlign: "center",
  fontFamily: "var(--font-space, system-ui), sans-serif",
};

const btn: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 8,
  border: "1px solid currentColor",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 14,
};

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={wrap}>
      <h2 style={{ margin: 0 }}>Something went wrong</h2>
      <p style={{ margin: 0, opacity: 0.75, maxWidth: 420 }}>
        Your plans and notes are stored locally in this browser and are not
        affected. Try again, or reload the page.
      </p>
      {error.digest && (
        <code style={{ fontSize: 12, opacity: 0.5 }}>ref: {error.digest}</code>
      )}
      <button style={btn} onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}

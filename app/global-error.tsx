"use client";

// global-error replaces the root layout when it crashes, so it must render
// its own <html>/<body> and cannot rely on global styles.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "system-ui, sans-serif",
          background: "#0c1116",
          color: "#e6e9ee",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ margin: 0, opacity: 0.75, maxWidth: 420 }}>
          Your plans and notes are stored locally in this browser and are not
          affected. Try again, or reload the page.
        </p>
        {error.digest && (
          <code style={{ fontSize: 12, opacity: 0.5 }}>ref: {error.digest}</code>
        )}
        <button
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid #e6e9ee",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            fontSize: 14,
          }}
          onClick={() => unstable_retry()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

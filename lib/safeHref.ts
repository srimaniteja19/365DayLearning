/**
 * Returns a safe href for rendered markdown/notes, or null if the scheme
 * is dangerous / unsupported (e.g. javascript:, data:).
 */
export function safeHref(raw: string | null | undefined): string | null {
  const href = String(raw || "").trim();
  if (!href) return null;

  const lower = href.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return null;
  }

  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:")
  ) {
    return href;
  }

  // Relative paths / in-page anchors are fine; reject other schemes.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("./") || href.startsWith("../")) {
    return href;
  }

  // Bare relative like "docs/foo" — allow as relative path.
  return href;
}

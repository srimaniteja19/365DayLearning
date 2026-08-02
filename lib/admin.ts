/**
 * Admin accounts get full Architect access with unlimited AI action / plan quotas,
 * max campaign length (730 days), highest concurrency, and access to admin tools.
 */
export const DEFAULT_ADMIN_EMAIL = "sreemanitejateja@gmail.com";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  if (target === DEFAULT_ADMIN_EMAIL) return true;
  const envAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return envAdmins.includes(target);
}

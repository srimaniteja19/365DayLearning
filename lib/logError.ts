export function logError(
  route: string,
  context: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      route,
      context,
      message,
      stack,
      ...extra,
      timestamp: new Date().toISOString(),
    }),
  );
}

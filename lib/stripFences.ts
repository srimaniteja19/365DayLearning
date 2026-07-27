export function stripFences(t: string): string {
  return t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

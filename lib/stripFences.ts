/** Strip markdown code fences wrapping a model response. */
export function stripFences(t: string): string {
  let s = t.trim();
  // Full-string fence: ```json ... ```
  const full = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (full) return full[1].trim();
  // Leading/trailing fence remnants
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return s;
}

/**
 * Pull the outermost JSON object or array from mixed prose/fence output.
 * Prefers the first `{`…`}` span, falling back to `[`…`]`.
 */
export function extractJsonBlob(t: string): string {
  const s = stripFences(t);
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  if (objStart < 0 && arrStart < 0) return s;

  const useArray =
    arrStart >= 0 && (objStart < 0 || arrStart < objStart);
  const start = useArray ? arrStart : objStart;
  const open = useArray ? "[" : "{";
  const close = useArray ? "]" : "}";

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start).trim();
}

/** Cheap local fixes before asking the model to repair. */
export function sanitizeJsonText(t: string): string {
  let s = extractJsonBlob(t);
  // Smart quotes → ASCII
  s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  // Trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s.trim();
}

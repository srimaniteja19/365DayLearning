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

function isValueStart(ch: string): boolean {
  return (
    ch === '"' ||
    ch === "{" ||
    ch === "[" ||
    ch === "-" ||
    ch === "t" ||
    ch === "f" ||
    ch === "n" ||
    (ch >= "0" && ch <= "9")
  );
}

/**
 * Insert commas when the model forgot them between adjacent values —
 * the classic `}\n{` / `"a"\n"b"` plan-outline failure mode.
 */
export function insertMissingCommas(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  const peekNonWs = (from: number): string | null => {
    for (let j = from; j < input.length; j++) {
      if (!/\s/.test(input[j])) return input[j];
    }
    return null;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    out += ch;

    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') {
        inString = false;
        const next = peekNonWs(i + 1);
        if (next && isValueStart(next)) out += ",";
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "}" || ch === "]") {
      const next = peekNonWs(i + 1);
      if (next && isValueStart(next)) out += ",";
    }
  }
  return out;
}

/** Cheap local fixes before asking the model to repair. */
export function sanitizeJsonText(t: string): string {
  let s = extractJsonBlob(t);
  // Smart quotes → ASCII
  s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  // Trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  // Missing commas between adjacent values
  s = insertMissingCommas(s);
  // In case insertMissingCommas interacted oddly with an already-valid trailing comma case
  s = s.replace(/,\s*([}\]])/g, "$1");
  return healJson(s.trim());
}

/**
 * Close truncated / unterminated JSON: escape raw control chars inside strings,
 * close an open string, then close outstanding braces/brackets.
 */
export function healJson(input: string): string {
  let s = input.trim();
  if (!s) return s;

  try {
    JSON.parse(s);
    return s;
  } catch {
    // continue healing
  }

  // Escape raw newlines/tabs inside strings (common model mistake)
  {
    let out = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (escape) {
          out += ch;
          escape = false;
          continue;
        }
        if (ch === "\\") {
          out += ch;
          escape = true;
          continue;
        }
        if (ch === '"') {
          out += ch;
          inString = false;
          continue;
        }
        if (ch === "\n") {
          out += "\\n";
          continue;
        }
        if (ch === "\r") {
          out += "\\r";
          continue;
        }
        if (ch === "\t") {
          out += "\\t";
          continue;
        }
        out += ch;
        continue;
      }
      out += ch;
      if (ch === '"') inString = true;
    }
    s = out;
  }

  try {
    JSON.parse(s);
    return s;
  } catch {
    // continue
  }

  // Close open string + outstanding brackets
  {
    let inString = false;
    let escape = false;
    const stack: string[] = [];
    for (let i = 0; i < s.length; i++) {
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
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") {
        if (stack.length && stack[stack.length - 1] === ch) stack.pop();
      }
    }
    if (inString) s += '"';
    // Drop a dangling incomplete key like `,"theme":` at the end
    s = s.replace(/,\s*"[^"]*":\s*$/g, "");
    s = s.replace(/,\s*$/g, "");
    while (stack.length) s += stack.pop();
  }

  try {
    JSON.parse(s);
    return s;
  } catch {
    return s;
  }
}

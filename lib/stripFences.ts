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

  const useArray = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
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

function peekNonWs(input: string, from: number): string | null {
  for (let j = from; j < input.length; j++) {
    if (!/\s/.test(input[j])) return input[j];
  }
  return null;
}

type Ctx = { kind: "object" | "array"; expect: "key" | "colon" | "value" | "comma" };

/**
 * Escape double-quotes that appear mid-string (models love writing `Say "hello"`).
 * Tracks object key vs value context so `"day" 1` / `"day"=1` keep a real key
 * closer (separator repair inserts `:`), while `"Use the "RPC" pattern"` and
 * `"Prefer "true" flags"` still escape inner quotes.
 */
export function escapeBrokenStringQuotes(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  let stringRole: "key" | "value" = "value";
  const stack: Ctx[] = [];
  const top = () => stack[stack.length - 1];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

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
        const next = peekNonWs(input, i + 1);
        const structuralCloser =
          next === null ||
          next === "," ||
          next === "}" ||
          next === "]" ||
          next === ":" ||
          next === '"' ||
          next === "=" ||
          next === "\uFF1A";
        // Only key strings may close before a bare value (`"day" 1`, `"topics" [`)
        const keyValueCloser =
          stringRole === "key" && next !== null && isValueStart(next);

        if (structuralCloser || keyValueCloser) {
          out += '"';
          inString = false;
          const ctx = top();
          if (stringRole === "key" && ctx?.kind === "object") {
            ctx.expect = "colon";
          } else if (stringRole === "value" && ctx) {
            ctx.expect = "comma";
          }
        } else {
          out += '\\"';
        }
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

    if (ch === '"') {
      const ctx = top();
      stringRole =
        ctx?.kind === "object" && ctx.expect === "key" ? "key" : "value";
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "{") {
      stack.push({ kind: "object", expect: "key" });
      out += ch;
      continue;
    }
    if (ch === "[") {
      stack.push({ kind: "array", expect: "value" });
      out += ch;
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (stack.length) {
        const ctx = stack[stack.length - 1];
        if ((ch === "}" && ctx.kind === "object") || (ch === "]" && ctx.kind === "array")) {
          stack.pop();
        }
      }
      const parent = top();
      if (parent) parent.expect = "comma";
      out += ch;
      continue;
    }
    if (ch === ":") {
      const ctx = top();
      if (ctx?.kind === "object") ctx.expect = "value";
      out += ch;
      continue;
    }
    if (ch === "=" || ch === "\uFF1A") {
      const ctx = top();
      if (ctx?.kind === "object" && ctx.expect === "colon") {
        if (ch === "=" && input[i + 1] === ">") i += 1;
        out += ":";
        ctx.expect = "value";
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === ",") {
      const ctx = top();
      if (ctx) ctx.expect = ctx.kind === "object" ? "key" : "value";
      out += ch;
      continue;
    }

    // Bare number / literal still counts as a value for context tracking
    if (ch === "-" || (ch >= "0" && ch <= "9") || ch === "t" || ch === "f" || ch === "n") {
      let j = i;
      if (ch === "-" || (ch >= "0" && ch <= "9")) {
        j += 1;
        while (j < input.length && /[0-9.eE+-]/.test(input[j])) j += 1;
      } else if (input.startsWith("true", i)) j = i + 4;
      else if (input.startsWith("false", i)) j = i + 5;
      else if (input.startsWith("null", i)) j = i + 4;
      else {
        out += ch;
        continue;
      }
      out += input.slice(i, j);
      const ctx = top();
      if (ctx) ctx.expect = "comma";
      i = j - 1;
      continue;
    }

    out += ch;
  }
  return out;
}

/** Normalize unicode / JS-style key separators before structural repair. */
export function normalizeJsonPunctuation(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    // Fullwidth colon → ASCII
    if (ch === "\uFF1A") {
      out += ":";
      continue;
    }
    // `=>` or `=` used as key/value separator (Python/JS habits)
    if (ch === "=") {
      if (input[i + 1] === ">") i += 1;
      out += ":";
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Convert single-quoted strings to double-quoted JSON strings.
 * Skips content already inside double quotes (so apostrophes in values survive).
 */
export function normalizeSingleQuotedStrings(input: string): string {
  let out = "";
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inDouble) {
      out += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      continue;
    }
    if (ch === "'") {
      out += '"';
      i += 1;
      while (i < input.length) {
        const c = input[i];
        if (c === "\\") {
          out += c;
          if (i + 1 < input.length) {
            out += input[i + 1];
            i += 2;
          } else {
            i += 1;
          }
          continue;
        }
        if (c === "'") {
          out += '"';
          break;
        }
        if (c === '"') {
          out += '\\"';
          i += 1;
          continue;
        }
        if (c === "\n") {
          out += "\\n";
          i += 1;
          continue;
        }
        if (c === "\r") {
          out += "\\r";
          i += 1;
          continue;
        }
        if (c === "\t") {
          out += "\\t";
          i += 1;
          continue;
        }
        out += c;
        i += 1;
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/** Quote bare object keys: `{ label: "x" }` → `{ "label": "x" }`. */
export function quoteBareKeys(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if ((ch === "{" || ch === ",") && i + 1 < input.length) {
      out += ch;
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) {
        out += input[j];
        j += 1;
      }
      if (j < input.length && /[A-Za-z_]/.test(input[j])) {
        const start = j;
        j += 1;
        while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
        let k = j;
        while (k < input.length && /\s/.test(input[k])) k += 1;
        if (input[k] === ":") {
          out += `"${input.slice(start, j)}"`;
          i = j - 1;
          continue;
        }
      }
      i = j - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Insert missing `:` between object keys and values, and missing `,` between
 * adjacent values. Critical: `"label" "foo"` must become `"label":"foo"`,
 * not `"label","foo"` (that yields "Expected ':' after property name").
 */
export function insertMissingSeparators(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  const stack: Ctx[] = [];
  const top = () => stack[stack.length - 1];

  const afterValueClosed = (nextFrom: number) => {
    const ctx = top();
    if (!ctx || ctx.expect !== "value") return;
    ctx.expect = "comma";
    const next = peekNonWs(input, nextFrom);
    if (next && isValueStart(next)) {
      out += ",";
      ctx.expect = ctx.kind === "object" ? "key" : "value";
    }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      out += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') {
        inString = false;
        const ctx = top();
        if (ctx?.kind === "object" && ctx.expect === "key") {
          ctx.expect = "colon";
          const next = peekNonWs(input, i + 1);
          if (next && isValueStart(next)) {
            out += ":";
            ctx.expect = "value";
          }
        } else if (ctx?.expect === "value") {
          afterValueClosed(i + 1);
        }
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "{") {
      stack.push({ kind: "object", expect: "key" });
      out += ch;
      continue;
    }
    if (ch === "[") {
      stack.push({ kind: "array", expect: "value" });
      out += ch;
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (stack.length) {
        const ctx = stack[stack.length - 1];
        // `"key"}` with no value → null
        if (ch === "}" && ctx.kind === "object" && ctx.expect === "colon") {
          out += ":null";
        }
        if ((ch === "}" && ctx.kind === "object") || (ch === "]" && ctx.kind === "array")) {
          stack.pop();
        }
      }
      out += ch;
      afterValueClosed(i + 1);
      continue;
    }

    if (ch === ":") {
      const ctx = top();
      if (ctx?.kind === "object") ctx.expect = "value";
      out += ch;
      continue;
    }

    // JS/Python-style separators left after punctuation normalize, or raw `=`
    if (ch === "=") {
      const ctx = top();
      if (ctx?.kind === "object" && (ctx.expect === "colon" || ctx.expect === "key")) {
        if (input[i + 1] === ">") i += 1;
        out += ":";
        ctx.expect = "value";
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === ",") {
      const ctx = top();
      // `"key",` with no value → treat as null so the rest of the object survives
      if (ctx?.kind === "object" && ctx.expect === "colon") {
        out += ":null";
      }
      if (ctx) ctx.expect = ctx.kind === "object" ? "key" : "value";
      out += ch;
      continue;
    }

    if (/\s/.test(ch)) {
      out += ch;
      continue;
    }

    // Numbers / true / false / null
    if (ch === "-" || (ch >= "0" && ch <= "9") || ch === "t" || ch === "f" || ch === "n") {
      let j = i;
      if (ch === "-" || (ch >= "0" && ch <= "9")) {
        j += 1;
        while (j < input.length && /[0-9.eE+-]/.test(input[j])) j += 1;
      } else if (input.startsWith("true", i)) j = i + 4;
      else if (input.startsWith("false", i)) j = i + 5;
      else if (input.startsWith("null", i)) j = i + 4;
      else {
        out += ch;
        continue;
      }
      out += input.slice(i, j);
      const ctx = top();
      if (ctx?.expect === "value") afterValueClosed(j);
      i = j - 1;
      continue;
    }

    out += ch;
  }

  return out;
}

/** @deprecated Use insertMissingSeparators — kept for older imports/tests. */
export function insertMissingCommas(input: string): string {
  return insertMissingSeparators(input);
}

/** Strip // line comments and block comments outside of strings. */
export function stripJsonComments(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && input[i + 1] === "/") {
      i += 2;
      while (i < input.length && input[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (ch === "/" && input[i + 1] === "*") {
      i += 2;
      while (i + 1 < input.length && !(input[i] === "*" && input[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Cheap local fixes before asking the model to repair. */
export function sanitizeJsonText(t: string): string {
  let s = extractJsonBlob(t);
  // Smart quotes → ASCII (keep apostrophe-like marks as `'` for single-quote normalize)
  s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  s = stripJsonComments(s);
  s = normalizeSingleQuotedStrings(s);
  s = quoteBareKeys(s);
  // Must run before escapeBrokenStringQuotes so `"day"=1` stays a closed key
  s = normalizeJsonPunctuation(s);
  s = escapeBrokenStringQuotes(s);
  // Trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = insertMissingSeparators(s);
  // In case separator insert interacted oddly with trailing commas
  s = s.replace(/,\s*([}\]])/g, "$1");
  return healJson(s.trim());
}

/** Parse after local healing. Throws SyntaxError/Zod-irrelevant JSON errors. */
export function parseJsonText(t: string): unknown {
  return JSON.parse(sanitizeJsonText(t));
}

/**
 * Close truncated / unterminated JSON: close an open string, then close
 * outstanding braces/brackets. Control chars inside strings are handled earlier.
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

  // Escape raw newlines/tabs inside strings (backup if escapeBrokenStringQuotes missed)
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

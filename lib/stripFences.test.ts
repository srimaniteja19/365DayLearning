import { describe, expect, it } from "vitest";
import {
  extractJsonBlob,
  healJson,
  insertMissingCommas,
  sanitizeJsonText,
  stripFences,
} from "@/lib/stripFences";

describe("stripFences / sanitizeJsonText", () => {
  it("strips fenced json", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("extracts object from surrounding prose", () => {
    expect(extractJsonBlob('Sure!\n{"domains":[{"id":"x","label":"X","weight":"large"}]}\nDone.')).toBe(
      '{"domains":[{"id":"x","label":"X","weight":"large"}]}',
    );
  });

  it("removes trailing commas and smart quotes", () => {
    const raw = `{
  "domains": [
    { "id": "ai-ml", "label": “AI / ML”, "weight": "large", },
  ],
}`;
    expect(JSON.parse(sanitizeJsonText(raw))).toEqual({
      domains: [{ id: "ai-ml", label: "AI / ML", weight: "large" }],
    });
  });

  it("inserts missing commas between array objects (plan outline failure mode)", () => {
    const raw = `{
  "periods": [
    {
      "label": "Week 1",
      "theme": "Foundations",
      "start": 1,
      "end": 7
    }
    {
      "label": "Week 2",
      "theme": "Core",
      "start": 8,
      "end": 14
    }
  ]
}`;
    expect(() => JSON.parse(raw)).toThrow(/Expected ',' or '\]'/);
    const fixed = sanitizeJsonText(raw);
    expect(JSON.parse(fixed).periods).toHaveLength(2);
  });

  it("does not break already-valid JSON", () => {
    const raw = `{"periods":[{"label":"W1","theme":"a","start":1,"end":7},{"label":"W2","theme":"b","start":8,"end":14}]}`;
    expect(sanitizeJsonText(raw)).toBe(raw);
    expect(insertMissingCommas(raw)).toBe(raw);
  });

  it("heals unterminated strings and truncated objects", () => {
    const raw = `{"periods":[{"label":"Week 1","theme":"Foundations of RPC`;
    expect(() => JSON.parse(raw)).toThrow(/Unterminated string/);
    const healed = healJson(raw);
    const parsed = JSON.parse(healed);
    expect(parsed.periods[0].label).toBe("Week 1");
    expect(parsed.periods[0].theme).toContain("Foundations");
  });

  it("escapes raw newlines inside strings", () => {
    const raw = `{"theme":"line one
line two","start":1}`;
    const healed = healJson(raw);
    expect(JSON.parse(healed)).toEqual({ theme: "line one\nline two", start: 1 });
  });
});

import { describe, expect, it } from "vitest";
import {
  escapeBrokenStringQuotes,
  extractJsonBlob,
  healJson,
  insertMissingSeparators,
  parseJsonText,
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

  it("inserts missing colons between keys and values (domain suggest failure mode)", () => {
    const raw = `{
  "domains": [
    { "id" "systems-eng", "label" "Systems Engineering", "weight" "large" }
    { "id" "ai-ml", "label" "AI / ML", "weight" "medium" }
  ]
}`;
    expect(() => JSON.parse(raw)).toThrow(/Expected ':' after property name/);
    const parsed = parseJsonText(raw) as {
      domains: Array<{ id: string; label: string; weight: string }>;
    };
    expect(parsed.domains).toEqual([
      { id: "systems-eng", label: "Systems Engineering", weight: "large" },
      { id: "ai-ml", label: "AI / ML", weight: "medium" },
    ]);
  });

  it("escapes unescaped quotes inside string values", () => {
    const raw = `{"label":"Use the "RPC" pattern","weight":"large"}`;
    expect(() => JSON.parse(raw)).toThrow();
    expect(JSON.parse(escapeBrokenStringQuotes(raw))).toEqual({
      label: 'Use the "RPC" pattern',
      weight: "large",
    });
    expect(parseJsonText(raw)).toEqual({
      label: 'Use the "RPC" pattern',
      weight: "large",
    });
  });

  it("quotes bare keys", () => {
    const raw = `{ domains: [ { id: "x", label: "X", weight: "large" } ] }`;
    expect(parseJsonText(raw)).toEqual({
      domains: [{ id: "x", label: "X", weight: "large" }],
    });
  });

  it("inserts missing colons before bare numbers and arrays", () => {
    const raw = `{"days":[{"day" 1,"topics" ["Raft Leader Election","Log Replication"]}]}`;
    expect(() => JSON.parse(raw)).toThrow(/Expected ':' after property name/);
    expect(parseJsonText(raw)).toEqual({
      days: [{ day: 1, topics: ["Raft Leader Election", "Log Replication"] }],
    });
  });

  it("normalizes = / => / fullwidth colons between keys and values", () => {
    expect(parseJsonText('{"day"=1,"topics"=["a","b"]}')).toEqual({
      day: 1,
      topics: ["a", "b"],
    });
    expect(parseJsonText('{"day" => 2, "topics" => ["c"]}')).toEqual({
      day: 2,
      topics: ["c"],
    });
    expect(parseJsonText('{"day"：3,"topics"：["d"]}')).toEqual({
      day: 3,
      topics: ["d"],
    });
  });

  it("converts single-quoted JSON-like strings", () => {
    expect(parseJsonText("{'day':1,'topics':['Raft Basics Intro']}")).toEqual({
      day: 1,
      topics: ["Raft Basics Intro"],
    });
  });

  it("still escapes inner quotes inside values that look like literals", () => {
    const raw = `{"topic":"Prefer "true" over false flags","day":1}`;
    expect(parseJsonText(raw)).toEqual({
      topic: 'Prefer "true" over false flags',
      day: 1,
    });
  });

  it("fills null for keys with no value before comma/brace", () => {
    expect(parseJsonText('{"day":1,"orphan","topics":["a"]}')).toEqual({
      day: 1,
      orphan: null,
      topics: ["a"],
    });
    expect(parseJsonText('{"day":1,"orphan"}')).toEqual({
      day: 1,
      orphan: null,
    });
  });

  it("does not break already-valid JSON", () => {
    const raw = `{"periods":[{"label":"W1","theme":"a","start":1,"end":7},{"label":"W2","theme":"b","start":8,"end":14}]}`;
    expect(sanitizeJsonText(raw)).toBe(raw);
    expect(insertMissingSeparators(raw)).toBe(raw);
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

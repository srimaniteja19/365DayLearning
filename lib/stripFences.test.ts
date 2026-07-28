import { describe, expect, it } from "vitest";
import { extractJsonBlob, sanitizeJsonText, stripFences } from "@/lib/stripFences";

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
});

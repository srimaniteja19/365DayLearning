import { describe, expect, it } from "vitest";
import {
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_FRONTIER,
  OPENROUTER_TOP_FREE,
  OPENROUTER_TOP_USAGE,
  buildModelCatalog,
  groupModelsByCategory,
  isFreeModel,
  vendorFromModelId,
} from "@/lib/providers/openrouter";

describe("openrouter model catalog helpers", () => {
  it("detects free models by :free suffix or zero pricing", () => {
    expect(isFreeModel({ id: "openai/gpt-oss-20b:free" })).toBe(true);
    expect(isFreeModel({ id: "openrouter/free", promptPrice: 0, completionPrice: 0 })).toBe(true);
    expect(
      isFreeModel({
        id: "anthropic/claude-opus-4.8",
        promptPrice: 0.000015,
        completionPrice: 0.000075,
      }),
    ).toBe(false);
  });

  it("groups paid into usage + frontier and free into top free", () => {
    const catalog = buildModelCatalog([]);
    const paid = groupModelsByCategory(catalog, "paid");
    expect(paid.map((g) => g.category)).toEqual(["usage", "frontier"]);
    expect(paid[0].models[0].id).toBe("xiaomi/mimo-v2.5");
    expect(paid[1].models.map((m) => m.id)).toEqual([...OPENROUTER_FRONTIER]);

    const free = groupModelsByCategory(catalog, "free");
    expect(free).toHaveLength(1);
    expect(free[0].models[0].id).toBe("openrouter/free");
    expect(free[0].models.some((m) => m.id === "google/gemma-4-31b-it:free")).toBe(true);
  });

  it("buildModelCatalog stays curated to the July 2026 top lists", () => {
    const catalog = buildModelCatalog([
      {
        id: "anthropic/claude-opus-5-fast",
        name: "Opus fast",
        vendor: "anthropic",
        free: false,
        created: 9e12,
      },
    ]);
    expect(catalog.some((m) => m.id === OPENROUTER_DEFAULT_MODEL)).toBe(true);
    expect(catalog.some((m) => m.id === "anthropic/claude-opus-4.8")).toBe(true);
    expect(catalog.some((m) => m.id === "anthropic/claude-opus-5-fast")).toBe(false);
    expect(catalog.filter((m) => !m.free).length).toBeLessThanOrEqual(
      OPENROUTER_TOP_USAGE.length + OPENROUTER_FRONTIER.length,
    );
    expect(OPENROUTER_TOP_FREE).toContain("openrouter/free");
    expect(vendorFromModelId("xiaomi/mimo-v2.5")).toBe("xiaomi");
  });
});

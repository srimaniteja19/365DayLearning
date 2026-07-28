import { describe, expect, it } from "vitest";
import { RateLimitError } from "@/lib/providers/errors";
import {
  OPENROUTER_CURATED_MODELS,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_PAID_FAILOVER,
  OPENROUTER_TOP_FREE,
  buildModelCatalog,
  buildModelFailoverChain,
  formatModelPrice,
  getCuratedModelMeta,
  groupModelsByCategory,
  isFailoverWorthyError,
  isFreeModel,
  shouldSkipRemainingFreeModels,
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

  it("groups paid by cost band cheapest to costliest and free separately", () => {
    const catalog = buildModelCatalog([]);
    const paid = groupModelsByCategory(catalog, "paid");
    expect(paid.map((g) => g.category)).toEqual(["budget", "mid", "frontier"]);
    expect(paid[0].models[0].id).toBe("deepseek/deepseek-v4-flash");
    expect(paid[0].models[0].tags).toContain("Default");
    expect(paid[2].models.some((m) => m.id === "anthropic/claude-opus-4.8")).toBe(true);
    expect(paid[2].models.some((m) => m.id === "moonshotai/kimi-k3")).toBe(true);

    const free = groupModelsByCategory(catalog, "free");
    expect(free).toHaveLength(1);
    expect(free[0].models[0].id).toBe("openrouter/free");
    expect(free[0].models.some((m) => m.id === "google/gemma-4-31b-it:free")).toBe(true);
  });

  it("attaches tags and sticker prices to curated models", () => {
    const meta = getCuratedModelMeta("deepseek/deepseek-v4-flash");
    expect(meta?.tags).toEqual(expect.arrayContaining(["Budget", "DeepSeek", "Default"]));
    expect(formatModelPrice(meta!)).toBe("$0.09 / $0.18 per M");

    const catalog = buildModelCatalog([]);
    expect(catalog.some((m) => m.id === OPENROUTER_DEFAULT_MODEL && m.tags?.includes("Default"))).toBe(true);
    expect(catalog.some((m) => m.id === "google/gemini-3.6-flash")).toBe(true);
    expect(catalog.some((m) => m.id === "anthropic/claude-opus-5-fast")).toBe(false);
    expect(catalog).toHaveLength(OPENROUTER_CURATED_MODELS.length);
    expect(OPENROUTER_TOP_FREE).toContain("openrouter/free");
    expect(vendorFromModelId("xiaomi/mimo-v2.5")).toBe("xiaomi");
  });
});

describe("model failover chain", () => {
  it("for a free primary tries other free models before paid", () => {
    const chain = buildModelFailoverChain("openrouter/free");
    expect(chain[0]).toBe("openrouter/free");
    const firstPaid = chain.findIndex((id) =>
      (OPENROUTER_PAID_FAILOVER as readonly string[]).includes(id),
    );
    expect(firstPaid).toBeGreaterThan(1);
    expect(
      chain.slice(0, firstPaid).every((id) => id.endsWith(":free") || id === "openrouter/free"),
    ).toBe(true);
    expect(chain).toContain("deepseek/deepseek-v4-flash");
  });

  it("skips free probing once session sticky is a paid model", () => {
    const chain = buildModelFailoverChain("openrouter/free", {
      sessionPreferred: "deepseek/deepseek-v4-flash",
    });
    expect(chain[0]).toBe("deepseek/deepseek-v4-flash");
    expect(chain.some((id) => id.endsWith(":free") || id === "openrouter/free")).toBe(false);
  });

  it("does not downgrade a paid primary to free models", () => {
    const chain = buildModelFailoverChain("deepseek/deepseek-v4-flash");
    expect(chain[0]).toBe("deepseek/deepseek-v4-flash");
    expect(chain.every((id) => !id.endsWith(":free") && id !== "openrouter/free")).toBe(true);
  });

  it("detects free daily caps and failover-worthy errors", () => {
    expect(
      shouldSkipRemainingFreeModels(
        new RateLimitError("Rate limit exceeded: free-models-per-day. Add 10 credits"),
      ),
    ).toBe(true);
    expect(isFailoverWorthyError(new RateLimitError("slow down"))).toBe(true);
    expect(isFailoverWorthyError(new Error("API key is invalid"))).toBe(false);
  });
});

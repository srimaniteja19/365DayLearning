import type { ChatRequest, Provider, ProviderConfig } from "@/lib/providers/types";
import { openAiCompatibleChat } from "@/lib/providers/openaiCompat";

/** Cost band used for Settings grouping (cheapest → costliest). */
export type CostBand = "free" | "budget" | "mid" | "frontier";

export type CuratedModelMeta = {
  id: string;
  costBand: CostBand;
  /** USD per million input tokens */
  inputPerM: number;
  /** USD per million output tokens */
  outputPerM: number;
  /** Chip tags shown in Settings */
  tags: string[];
  /** Cheapest → costliest sort key */
  sortOrder: number;
};

/**
 * Full picker catalog with tags + sticker prices (USD / M tokens).
 * Sorted cheapest → costliest within each band.
 */
export const OPENROUTER_CURATED_MODELS: readonly CuratedModelMeta[] = [
  // Free
  { id: "openrouter/free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "Auto-router"], sortOrder: 1 },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "NVIDIA", "Long-context"], sortOrder: 2 },
  { id: "poolside/laguna-s-2.1:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "Poolside", "Coding"], sortOrder: 3 },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "NVIDIA", "Agentic"], sortOrder: 4 },
  { id: "cohere/north-mini-code:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "Cohere", "Coding"], sortOrder: 5 },
  { id: "poolside/laguna-xs-2.1:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "Poolside", "Coding"], sortOrder: 6 },
  { id: "openai/gpt-oss-20b:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "OpenAI", "Open-weight"], sortOrder: 7 },
  { id: "google/gemma-4-31b-it:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "Google", "Multimodal"], sortOrder: 8 },
  { id: "google/gemma-4-26b-a4b-it:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "Google", "MoE"], sortOrder: 9 },
  { id: "inclusionai/ling-3.0-flash:free", costBand: "free", inputPerM: 0, outputPerM: 0, tags: ["Free", "InclusionAI"], sortOrder: 10 },
  // Budget
  { id: "deepseek/deepseek-v4-flash", costBand: "budget", inputPerM: 0.09, outputPerM: 0.18, tags: ["Budget", "DeepSeek", "Default"], sortOrder: 11 },
  { id: "minimax/minimax-m3", costBand: "budget", inputPerM: 0.1, outputPerM: 1.21, tags: ["Budget", "MiniMax", "Multimodal"], sortOrder: 12 },
  { id: "xiaomi/mimo-v2.5", costBand: "budget", inputPerM: 0.11, outputPerM: 0.22, tags: ["Budget", "Xiaomi"], sortOrder: 13 },
  { id: "tencent/hy3", costBand: "budget", inputPerM: 0.14, outputPerM: 0.58, tags: ["Budget", "Tencent", "Agentic"], sortOrder: 14 },
  { id: "stepfun/step-3.7-flash", costBand: "budget", inputPerM: 0.2, outputPerM: 1.15, tags: ["Budget", "StepFun", "Fast"], sortOrder: 15 },
  { id: "google/gemini-3.5-flash-lite", costBand: "budget", inputPerM: 0.3, outputPerM: 2.5, tags: ["Budget", "Google", "High-volume"], sortOrder: 16 },
  { id: "deepseek/deepseek-v4-pro", costBand: "budget", inputPerM: 0.44, outputPerM: 0.87, tags: ["Budget", "DeepSeek", "SWE-bench"], sortOrder: 17 },
  // Mid-tier
  { id: "nvidia/nemotron-3-ultra-550b-a55b", costBand: "mid", inputPerM: 0.5, outputPerM: 2.5, tags: ["Mid-tier", "NVIDIA", "1M ctx"], sortOrder: 18 },
  { id: "z-ai/glm-5.2", costBand: "mid", inputPerM: 0.45, outputPerM: 3.31, tags: ["Mid-tier", "Z.ai", "Open-weight IQ"], sortOrder: 19 },
  { id: "x-ai/grok-4.5", costBand: "mid", inputPerM: 2, outputPerM: 6, tags: ["Mid-tier", "xAI", "Cheapest frontier"], sortOrder: 20 },
  { id: "google/gemini-3.6-flash", costBand: "mid", inputPerM: 1.5, outputPerM: 7.5, tags: ["Mid-tier", "Google", "Coding"], sortOrder: 21 },
  { id: "google/gemini-3.5-flash", costBand: "mid", inputPerM: 1.5, outputPerM: 9, tags: ["Mid-tier", "Google"], sortOrder: 22 },
  { id: "google/gemini-3.1-pro-preview", costBand: "mid", inputPerM: 2, outputPerM: 12, tags: ["Mid-tier", "Google", "Long-ctx pricing"], sortOrder: 23 },
  // Frontier
  { id: "moonshotai/kimi-k3", costBand: "frontier", inputPerM: 3, outputPerM: 15, tags: ["Frontier", "Moonshot", "Cache-friendly"], sortOrder: 24 },
  { id: "anthropic/claude-opus-4.8", costBand: "frontier", inputPerM: 5, outputPerM: 25, tags: ["Frontier", "Anthropic", "Top intelligence"], sortOrder: 25 },
  { id: "openai/gpt-5.6-sol", costBand: "frontier", inputPerM: 5, outputPerM: 30, tags: ["Frontier", "OpenAI", "Costliest"], sortOrder: 26 },
];

const META_BY_ID = Object.fromEntries(
  OPENROUTER_CURATED_MODELS.map((m) => [m.id, m]),
) as Record<string, CuratedModelMeta>;

export function getCuratedModelMeta(id: string): CuratedModelMeta | undefined {
  return META_BY_ID[id];
}

export const OPENROUTER_TOP_FREE: readonly string[] = OPENROUTER_CURATED_MODELS
  .filter((m) => m.costBand === "free")
  .map((m) => m.id);

const OPENROUTER_CATEGORY_LABELS: Record<CostBand, string> = {
  free: "Free",
  budget: "Budget",
  mid: "Mid-tier",
  frontier: "Frontier",
};

const OPENROUTER_SUGGESTED_MODELS = OPENROUTER_CURATED_MODELS.map((m) => m.id);

/** Sensible default: fast, cheap, widely used for agentic work. */
export const OPENROUTER_DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

export type ModelPricingTier = "free" | "paid";

export type OpenRouterModelInfo = {
  id: string;
  name: string;
  vendor: string;
  free: boolean;
  category?: CostBand;
  tags?: string[];
  inputPerM?: number;
  outputPerM?: number;
  sortOrder?: number;
  created?: number;
  contextLength?: number;
  promptPrice?: number;
  completionPrice?: number;
};

export function vendorFromModelId(id: string): string {
  const slash = id.indexOf("/");
  return slash > 0 ? id.slice(0, slash) : "other";
}

export function shortModelName(id: string): string {
  return id.replace(/^[^/]+\//, "").replace(/:free$/, "");
}

export function formatModelPrice(meta: Pick<CuratedModelMeta, "inputPerM" | "outputPerM" | "costBand">): string {
  if (meta.costBand === "free" || (meta.inputPerM === 0 && meta.outputPerM === 0)) return "$0 / $0";
  const fmt = (n: number) => (n < 1 ? `$${n.toFixed(2)}` : `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`);
  return `${fmt(meta.inputPerM)} / ${fmt(meta.outputPerM)} per M`;
}

export function isFreeModel(m: {
  id: string;
  promptPrice?: number;
  completionPrice?: number;
}): boolean {
  if (m.id.endsWith(":free") || m.id === "openrouter/free") return true;
  return (m.promptPrice ?? 1) === 0 && (m.completionPrice ?? 1) === 0;
}

/** Cheap/popular paid models used only after free options fail. */
export const OPENROUTER_PAID_FAILOVER: readonly string[] = [
  "deepseek/deepseek-v4-flash",
  "google/gemini-3.6-flash",
  "google/gemini-3.5-flash-lite",
  "xiaomi/mimo-v2.5",
  "tencent/hy3",
  "deepseek/deepseek-v4-pro",
  "google/gemini-3.5-flash",
  "stepfun/step-3.7-flash",
  "moonshotai/kimi-k3",
  "z-ai/glm-5.2",
  "minimax/minimax-m3",
];

export function isFreeModelId(id: string): boolean {
  return isFreeModel({ id });
}

/**
 * Ordered failover candidates for a primary model.
 * Free primary → other free → cheap paid.
 * Paid primary → that model, then other cheap paid (no free downgrade).
 * If this session already landed on a paid sticky model after free failures,
 * skip re-probing free models on every subsequent call.
 */
export function buildModelFailoverChain(
  primary: string,
  opts?: { sessionPreferred?: string | null },
): string[] {
  const preferred = opts?.sessionPreferred?.trim() || "";
  const out: string[] = [];
  const push = (id: string) => {
    if (id && !out.includes(id)) out.push(id);
  };

  if (isFreeModelId(primary)) {
    if (preferred && !isFreeModelId(preferred)) {
      push(preferred);
      for (const id of OPENROUTER_PAID_FAILOVER) push(id);
      return out;
    }

    push(primary);
    for (const id of OPENROUTER_TOP_FREE) push(id);
    if (preferred) {
      // Move sticky free success near the front (after primary).
      const rest = out.filter((id) => id !== preferred && id !== primary);
      out.length = 0;
      push(primary);
      push(preferred);
      for (const id of rest) push(id);
    }
    for (const id of OPENROUTER_PAID_FAILOVER) push(id);
    return out;
  }

  push(primary);
  if (preferred) push(preferred);
  for (const id of OPENROUTER_PAID_FAILOVER) push(id);
  return out;
}

/** Account-wide free daily caps won't clear by switching :free models. */
export function shouldSkipRemainingFreeModels(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "");
  return /free-models-per-day|free-model daily limit|free model requests per day/i.test(msg);
}

export function isFailoverWorthyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Never rotate keys / auth failures across models.
  if (err.name === "AuthError") return false;
  if (err.name === "AbortError") return false;
  if (err instanceof DOMException && err.name === "AbortError") return false;

  const maybeCode = (err as unknown as { code?: unknown }).code;
  const code = typeof maybeCode === "string" ? maybeCode : "";
  if (code === "auth" || code === "subscription") return false;

  // Rate limits, quota on a specific free model, empty/bad content, HTTP 5xx-ish.
  if (
    code === "rate_limit" ||
    code === "quota" ||
    code === "content" ||
    code === "network" ||
    code === "http"
  ) {
    return true;
  }

  const msg = err.message || "";
  return /rate limit|unavailable|overloaded|timeout|empty response|not found|no endpoints|provider returned error/i.test(
    msg,
  );
}

/** Last model that succeeded after failover this tab session. */
let sessionPreferredModel: string | null = null;

export function getSessionPreferredModel(): string | null {
  return sessionPreferredModel;
}

export function setSessionPreferredModel(model: string | null): void {
  sessionPreferredModel = model;
}

export function clearSessionPreferredModel(): void {
  sessionPreferredModel = null;
}

export type ModelCategoryGroup = {
  category: CostBand;
  label: string;
  models: OpenRouterModelInfo[];
};

/** Group curated models by cost band for the active Free/Paid tab. */
export function groupModelsByCategory(
  models: OpenRouterModelInfo[],
  tier: ModelPricingTier,
): ModelCategoryGroup[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const bands: CostBand[] =
    tier === "free" ? ["free"] : ["budget", "mid", "frontier"];

  return bands
    .map((band) => {
      const ids = OPENROUTER_CURATED_MODELS.filter((m) => m.costBand === band).map((m) => m.id);
      const list = ids
        .map((id) => byId.get(id))
        .filter((m): m is OpenRouterModelInfo => !!m && (tier === "free" ? m.free : !m.free))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return {
        category: band,
        label: OPENROUTER_CATEGORY_LABELS[band],
        models: list,
      };
    })
    .filter((g) => g.models.length > 0);
}

function curatedAsInfo(meta: CuratedModelMeta): OpenRouterModelInfo {
  return {
    id: meta.id,
    name: meta.id,
    vendor: vendorFromModelId(meta.id),
    free: meta.costBand === "free",
    category: meta.costBand,
    tags: [...meta.tags],
    inputPerM: meta.inputPerM,
    outputPerM: meta.outputPerM,
    sortOrder: meta.sortOrder,
  };
}

/**
 * Catalog for the Settings picker: curated top models only.
 * Live API refreshes pricing/context flags when available.
 */
export function buildModelCatalog(live: OpenRouterModelInfo[]): OpenRouterModelInfo[] {
  const liveById = new Map(live.map((m) => [m.id, m]));
  return OPENROUTER_CURATED_MODELS.map((meta) => {
    const base = curatedAsInfo(meta);
    const liveHit = liveById.get(meta.id);
    if (!liveHit) return base;
    return {
      ...liveHit,
      free: meta.costBand === "free" || liveHit.free,
      category: meta.costBand,
      tags: [...meta.tags],
      inputPerM: meta.inputPerM,
      outputPerM: meta.outputPerM,
      sortOrder: meta.sortOrder,
    };
  });
}

/** Public OpenRouter models list (no key required). */
export async function fetchOpenRouterModels(signal?: AbortSignal): Promise<OpenRouterModelInfo[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal });
  if (!res.ok) throw new Error(`OpenRouter models failed (${res.status})`);
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      created?: number;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { input_modalities?: string[]; output_modalities?: string[] };
    }>;
  };
  const curated = new Set<string>(OPENROUTER_SUGGESTED_MODELS);
  const rows = (json.data || []).filter((m) => {
    if (!curated.has(m.id)) return false;
    const outs = m.architecture?.output_modalities || ["text"];
    const inns = m.architecture?.input_modalities || ["text"];
    return outs.includes("text") && inns.includes("text") && !m.id.includes(":batch");
  });
  return rows.map((m) => {
    const promptPrice = parseFloat(m.pricing?.prompt || "0");
    const completionPrice = parseFloat(m.pricing?.completion || "0");
    const info: OpenRouterModelInfo = {
      id: m.id,
      name: m.name || m.id,
      vendor: vendorFromModelId(m.id),
      free: false,
      created: m.created,
      contextLength: m.context_length,
      promptPrice: Number.isFinite(promptPrice) ? promptPrice : undefined,
      completionPrice: Number.isFinite(completionPrice) ? completionPrice : undefined,
    };
    info.free = isFreeModel(info);
    return info;
  });
}

export const openrouterProvider: Provider = {
  id: "openrouter",
  label: "OpenRouter",
  models: [...OPENROUTER_SUGGESTED_MODELS],
  needsKey: true,
  keyHint: "sk-or-...",
  docsUrl: "https://openrouter.ai/keys",
  defaultBaseUrl: "https://openrouter.ai/api",

  async chat(req: ChatRequest, cfg: ProviderConfig): Promise<string> {
    const base = (cfg.baseUrl || this.defaultBaseUrl!).replace(/\/$/, "");
    return openAiCompatibleChat(
      `${base}/v1/chat/completions`,
      req,
      cfg,
      {
        "HTTP-Referer":
          typeof window !== "undefined" ? window.location.origin : "https://refrainly.app",
        "X-Title": "Refrainly",
      },
      { preferJsonSchema: false },
    );
  },
};

import type { ChatRequest, Provider, ProviderConfig } from "@/lib/providers/types";
import { openAiCompatibleChat } from "@/lib/providers/openaiCompat";

/**
 * Top OpenRouter models by category (usage / intelligence, July 2026).
 * IDs match OpenRouter’s public catalog.
 */
export const OPENROUTER_TOP_USAGE: readonly string[] = [
  "xiaomi/mimo-v2.5",
  "deepseek/deepseek-v4-flash",
  "tencent/hy3",
  "deepseek/deepseek-v4-pro",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "z-ai/glm-5.2",
  "minimax/minimax-m3",
  "stepfun/step-3.7-flash",
  "moonshotai/kimi-k3",
];

/** Premium / frontier when quality > price. */
export const OPENROUTER_FRONTIER: readonly string[] = [
  "anthropic/claude-opus-4.8",
  "openai/gpt-5.6-sol",
  "x-ai/grok-4.5",
];

/** Latest Google Gemini models on OpenRouter. */
export const OPENROUTER_GOOGLE: readonly string[] = [
  "google/gemini-3.6-flash",
  "google/gemini-3.5-flash",
  "google/gemini-3.5-flash-lite",
  "google/gemini-3.1-pro-preview",
];

export const OPENROUTER_TOP_FREE: readonly string[] = [
  "openrouter/free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "poolside/laguna-s-2.1:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "cohere/north-mini-code:free",
  "poolside/laguna-xs-2.1:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "inclusionai/ling-3.0-flash:free",
];

export type ModelCategory = "usage" | "frontier" | "google" | "free";

export const OPENROUTER_CATEGORY_LABELS: Record<ModelCategory, string> = {
  usage: "Top by usage",
  frontier: "Frontier",
  google: "Google Gemini",
  free: "Top free",
};

export const OPENROUTER_VENDOR_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "x-ai": "xAI",
  deepseek: "DeepSeek",
  xiaomi: "Xiaomi",
  tencent: "Tencent",
  nvidia: "NVIDIA",
  "z-ai": "Z.ai",
  minimax: "MiniMax",
  stepfun: "StepFun",
  moonshotai: "Moonshot",
  inclusionai: "InclusionAI",
  poolside: "Poolside",
  cohere: "Cohere",
  openrouter: "OpenRouter",
};

export const OPENROUTER_SUGGESTED_MODELS = [
  ...OPENROUTER_TOP_USAGE,
  ...OPENROUTER_FRONTIER,
  ...OPENROUTER_GOOGLE,
  ...OPENROUTER_TOP_FREE,
] as const;

/** Sensible default: fast, cheap, widely used for agentic work. */
export const OPENROUTER_DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

export type ModelPricingTier = "free" | "paid";

export type OpenRouterModelInfo = {
  id: string;
  name: string;
  vendor: string;
  free: boolean;
  category?: ModelCategory;
  created?: number;
  contextLength?: number;
  promptPrice?: number;
  completionPrice?: number;
};

export function vendorFromModelId(id: string): string {
  const slash = id.indexOf("/");
  return slash > 0 ? id.slice(0, slash) : "other";
}

export function vendorLabel(vendor: string): string {
  return OPENROUTER_VENDOR_LABELS[vendor] || vendor;
}

export function shortModelName(id: string): string {
  return id.replace(/^[^/]+\//, "").replace(/:free$/, "");
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
  category: ModelCategory;
  label: string;
  models: OpenRouterModelInfo[];
};

/** Group curated models in display order for the active tier. */
export function groupModelsByCategory(
  models: OpenRouterModelInfo[],
  tier: ModelPricingTier,
): ModelCategoryGroup[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const groups: ModelCategoryGroup[] = [];

  if (tier === "paid") {
    const usage = OPENROUTER_TOP_USAGE.map((id) => byId.get(id)).filter(
      (m): m is OpenRouterModelInfo => !!m && !m.free,
    );
    const frontier = OPENROUTER_FRONTIER.map((id) => byId.get(id)).filter(
      (m): m is OpenRouterModelInfo => !!m && !m.free,
    );
    const google = OPENROUTER_GOOGLE.map((id) => byId.get(id)).filter(
      (m): m is OpenRouterModelInfo => !!m && !m.free,
    );
    if (usage.length) {
      groups.push({ category: "usage", label: OPENROUTER_CATEGORY_LABELS.usage, models: usage });
    }
    if (frontier.length) {
      groups.push({
        category: "frontier",
        label: OPENROUTER_CATEGORY_LABELS.frontier,
        models: frontier,
      });
    }
    if (google.length) {
      groups.push({
        category: "google",
        label: OPENROUTER_CATEGORY_LABELS.google,
        models: google,
      });
    }
  } else {
    const free = OPENROUTER_TOP_FREE.map((id) => byId.get(id)).filter(
      (m): m is OpenRouterModelInfo => !!m && m.free,
    );
    if (free.length) {
      groups.push({ category: "free", label: OPENROUTER_CATEGORY_LABELS.free, models: free });
    }
  }

  return groups;
}

/** @deprecated Prefer groupModelsByCategory — kept for older imports/tests. */
export type ModelVendorGroup = {
  vendor: string;
  label: string;
  models: OpenRouterModelInfo[];
};

export function groupModelsByVendor(models: OpenRouterModelInfo[]): ModelVendorGroup[] {
  const preferred = Object.keys(OPENROUTER_VENDOR_LABELS);
  const map = new Map<string, OpenRouterModelInfo[]>();
  for (const m of models) {
    const list = map.get(m.vendor) || [];
    list.push(m);
    map.set(m.vendor, list);
  }
  const vendors = Array.from(map.keys()).sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  return vendors.map((vendor) => ({
    vendor,
    label: vendorLabel(vendor),
    models: (map.get(vendor) || []).slice().sort((a, b) => a.id.localeCompare(b.id)),
  }));
}

function curatedAsInfo(id: string, free: boolean, category: ModelCategory): OpenRouterModelInfo {
  return {
    id,
    name: id,
    vendor: vendorFromModelId(id),
    free,
    category,
  };
}

/**
 * Catalog for the Settings picker: curated top models only.
 * Live API refreshes pricing/context flags when available.
 */
export function buildModelCatalog(live: OpenRouterModelInfo[]): OpenRouterModelInfo[] {
  const liveById = new Map(live.map((m) => [m.id, m]));
  const out: OpenRouterModelInfo[] = [];
  const seen = new Set<string>();

  const push = (id: string, free: boolean, category: ModelCategory) => {
    if (seen.has(id)) return;
    seen.add(id);
    const liveHit = liveById.get(id);
    if (liveHit) {
      out.push({
        ...liveHit,
        free: free || liveHit.free,
        category,
      });
      return;
    }
    out.push(curatedAsInfo(id, free, category));
  };

  for (const id of OPENROUTER_TOP_USAGE) {
    push(id, isFreeModel({ id }), "usage");
  }
  for (const id of OPENROUTER_FRONTIER) {
    push(id, false, "frontier");
  }
  for (const id of OPENROUTER_GOOGLE) {
    push(id, false, "google");
  }
  for (const id of OPENROUTER_TOP_FREE) {
    push(id, true, "free");
  }

  return out;
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

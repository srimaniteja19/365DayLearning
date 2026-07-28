import type { Provider, ProviderId } from "@/lib/providers/types";
import { openrouterProvider } from "@/lib/providers/openrouter";

/** Refrainly uses OpenRouter exclusively for BYOK model access. */
export const PROVIDERS: Provider[] = [openrouterProvider];

export const PROVIDERS_BY_ID: Record<ProviderId, Provider> = {
  openrouter: openrouterProvider,
};

export function getProvider(id: ProviderId | string): Provider {
  if (id === "openrouter") return openrouterProvider;
  // Legacy saved provider ids all map to OpenRouter now.
  return openrouterProvider;
}

export * from "@/lib/providers/types";
export * from "@/lib/providers/errors";
export {
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_SUGGESTED_MODELS,
  fetchOpenRouterModels,
} from "@/lib/providers/openrouter";

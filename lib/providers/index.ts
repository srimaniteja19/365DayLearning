import { anthropicProvider } from "@/lib/providers/anthropic";
import { openaiProvider, openrouterProvider } from "@/lib/providers/openai";
import { geminiProvider } from "@/lib/providers/gemini";
import { ollamaProvider } from "@/lib/providers/ollama";
import type { Provider, ProviderId } from "@/lib/providers/types";

export const PROVIDERS: Provider[] = [
  anthropicProvider,
  openaiProvider,
  geminiProvider,
  openrouterProvider,
  ollamaProvider,
];

export const PROVIDERS_BY_ID: Record<ProviderId, Provider> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<ProviderId, Provider>;

export function getProvider(id: ProviderId): Provider {
  const p = PROVIDERS_BY_ID[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export * from "@/lib/providers/types";
export * from "@/lib/providers/errors";

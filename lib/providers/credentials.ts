import { CREDENTIALS_STORAGE_KEY, type CredentialsState, type ProviderId } from "@/lib/providers/types";
import { anthropicProvider } from "@/lib/providers/anthropic";
import { openaiProvider, openrouterProvider } from "@/lib/providers/openai";
import { geminiProvider } from "@/lib/providers/gemini";
import { ollamaProvider } from "@/lib/providers/ollama";

const PROVIDERS_BY_ID = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  ollama: ollamaProvider,
} as const;

/** In-memory credentials — cleared when the tab closes unless remember is set. */
let memory: CredentialsState = {
  providerId: "anthropic",
  model: PROVIDERS_BY_ID.anthropic.models[0],
  apiKey: undefined,
  baseUrl: undefined,
  remember: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeCredentials(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCredentials(): CredentialsState {
  return { ...memory };
}

export function setCredentials(partial: Partial<CredentialsState>): CredentialsState {
  memory = { ...memory, ...partial };
  if (memory.remember) {
    persistRemembered();
  } else {
    clearPersisted();
  }
  notify();
  return getCredentials();
}

export function forgetCredentials(): void {
  memory = {
    ...memory,
    apiKey: undefined,
    remember: false,
  };
  clearPersisted();
  notify();
}

export function maskApiKey(key?: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
}

function persistRemembered(): void {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      providerId: memory.providerId,
      model: memory.model,
      apiKey: memory.apiKey || "",
      baseUrl: memory.baseUrl || "",
      remember: true,
    };
    window.localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Load remembered credentials once on client boot. Never logs the key. */
export function hydrateCredentialsFromStorage(): CredentialsState {
  if (typeof window === "undefined") return getCredentials();
  try {
    const raw = window.localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) return getCredentials();
    const parsed = JSON.parse(raw) as Partial<CredentialsState>;
    const providerId = (parsed.providerId || "anthropic") as ProviderId;
    const provider = PROVIDERS_BY_ID[providerId] || PROVIDERS_BY_ID.anthropic;
    memory = {
      providerId: provider.id,
      model: parsed.model || provider.models[0],
      apiKey: typeof parsed.apiKey === "string" && parsed.apiKey ? parsed.apiKey : undefined,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : undefined,
      remember: true,
    };
    notify();
  } catch {
    clearPersisted();
  }
  return getCredentials();
}

/** Ensure export payloads never contain credential substrings. */
export function assertNoCredentialsInExport(payload: string, apiKey?: string): void {
  if (!apiKey) return;
  if (payload.includes(apiKey)) {
    throw new Error("Export leaked an API key");
  }
}

export function stripCredentialsFromObject<T extends Record<string, unknown>>(obj: T): T {
  const clone = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  delete clone.apiKey;
  delete clone.credentials;
  delete clone.credential;
  if (clone.provider && typeof clone.provider === "object") {
    const p = clone.provider as Record<string, unknown>;
    delete p.apiKey;
  }
  return clone as T;
}

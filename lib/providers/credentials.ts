import {
  CREDENTIALS_STORAGE_KEY,
  type CredentialsState,
  type ProviderId,
} from "@/lib/providers/types";
import {
  OPENROUTER_DEFAULT_MODEL,
  clearSessionPreferredModel,
  openrouterProvider,
} from "@/lib/providers/openrouter";

/** In-memory credentials — cleared when the tab closes unless remember is set. */
let memory: CredentialsState = {
  providerId: "openrouter",
  model: OPENROUTER_DEFAULT_MODEL,
  apiKey: undefined,
  baseUrl: openrouterProvider.defaultBaseUrl,
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
  const modelChanged =
    partial.model !== undefined && partial.model !== memory.model;
  memory = {
    ...memory,
    ...partial,
    // Always OpenRouter — ignore attempts to set another provider.
    providerId: "openrouter",
  };
  if (!memory.baseUrl) memory.baseUrl = openrouterProvider.defaultBaseUrl;
  if (modelChanged) clearSessionPreferredModel();
  if (memory.remember) {
    persistRemembered();
  } else {
    clearPersisted();
  }
  notify();
  return getCredentials();
}

function persistRemembered() {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      providerId: "openrouter" as ProviderId,
      model: memory.model,
      apiKey: memory.apiKey,
      baseUrl: memory.baseUrl || openrouterProvider.defaultBaseUrl,
      remember: true,
    };
    window.localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function forgetCredentials(): CredentialsState {
  memory = {
    providerId: "openrouter",
    model: memory.model || OPENROUTER_DEFAULT_MODEL,
    apiKey: undefined,
    baseUrl: openrouterProvider.defaultBaseUrl,
    remember: false,
  };
  clearPersisted();
  notify();
  return getCredentials();
}

export function hydrateCredentialsFromStorage(): CredentialsState {
  if (typeof window === "undefined") return getCredentials();
  try {
    const raw = window.localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) {
      // Migrate away from any non-OpenRouter in-memory defaults.
      memory = {
        ...memory,
        providerId: "openrouter",
        baseUrl: memory.baseUrl || openrouterProvider.defaultBaseUrl,
        model: memory.model || OPENROUTER_DEFAULT_MODEL,
      };
      return getCredentials();
    }
    const parsed = JSON.parse(raw) as Partial<CredentialsState>;
    memory = {
      providerId: "openrouter",
      model: parsed.model || OPENROUTER_DEFAULT_MODEL,
      apiKey: parsed.apiKey,
      baseUrl: parsed.baseUrl || openrouterProvider.defaultBaseUrl,
      remember: true,
    };
    // Rewrite storage so old provider ids don't stick around.
    persistRemembered();
    notify();
  } catch {
    // ignore corrupt storage
  }
  return getCredentials();
}

export function maskApiKey(key?: string): string {
  const k = (key || "").trim();
  if (k.length <= 10) return "••••••••";
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

export function stripCredentialsFromObject<T extends Record<string, unknown>>(obj: T): T {
  const clone = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  delete clone.apiKey;
  delete clone.credentials;
  if (clone.provider && typeof clone.provider === "object") {
    const p = clone.provider as Record<string, unknown>;
    delete p.apiKey;
  }
  return clone as T;
}

export function assertNoCredentialsInExport(text: string, key?: string): void {
  if (key && key.trim() && text.includes(key.trim())) {
    throw new Error("Export leaked an API key.");
  }
}

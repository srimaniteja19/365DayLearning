export type StructuredSchema = {
  name: string;
  description?: string;
  /** JSON Schema object passed to the provider's tool / structured-output API. */
  schema: Record<string, unknown>;
};

export type ChatRequest = {
  system?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  /** When set, providers that support it return a tool/structured payload. */
  structured?: StructuredSchema;
};

export type ProviderConfig = {
  apiKey?: string;
  model: string;
  baseUrl?: string;
};

export type ProviderId = "openrouter";

export interface Provider {
  id: ProviderId;
  label: string;
  models: string[];
  needsKey: boolean;
  keyHint: string;
  docsUrl: string;
  defaultBaseUrl?: string;
  chat(req: ChatRequest, cfg: ProviderConfig): Promise<string>;
}

export type CredentialsState = {
  providerId: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  remember: boolean;
};

export const CREDENTIALS_STORAGE_KEY = "dualtrack:credentials";

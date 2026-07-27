export type ChatRequest = {
  system?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type ProviderConfig = {
  apiKey?: string;
  model: string;
  baseUrl?: string;
};

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "openrouter"
  | "ollama";

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

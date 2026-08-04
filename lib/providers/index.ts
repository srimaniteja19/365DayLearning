import type { Provider } from "@/lib/providers/types";
import { openrouterProvider } from "@/lib/providers/openrouter";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getProvider(_legacyId?: string): Provider {
  // Legacy saved provider ids all map to OpenRouter.
  return openrouterProvider;
}

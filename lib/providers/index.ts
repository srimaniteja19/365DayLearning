import type { Provider } from "@/lib/providers/types";
import { openrouterProvider } from "@/lib/providers/openrouter";

export function getProvider(_id?: string): Provider {
  // Legacy saved provider ids all map to OpenRouter.
  return openrouterProvider;
}

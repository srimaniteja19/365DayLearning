import { afterEach, describe, expect, it } from "vitest";
import { willUseManagedAi } from "@/lib/claude-client";
import { forgetCredentials, setCredentials } from "@/lib/providers/credentials";
import { setCachedSubscriptionTier } from "@/lib/subscriptions";

describe("managed AI selection", () => {
  afterEach(() => {
    forgetCredentials();
    setCachedSubscriptionTier(null);
  });

  it("uses Recruit's managed allowance when no BYOK key is configured", () => {
    setCachedSubscriptionTier("free");
    expect(willUseManagedAi()).toBe(true);
  });

  it("always prefers BYOK over a managed allowance", () => {
    setCachedSubscriptionTier("free");
    setCredentials({ apiKey: "sk-or-v1-test-key" });
    expect(willUseManagedAi()).toBe(false);
  });
});

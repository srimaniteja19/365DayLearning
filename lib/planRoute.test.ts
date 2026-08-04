import { describe, expect, it } from "vitest";
import { createPlanRouteSlug, findPlanByRouteSegment, planRouteSegment } from "@/lib/planRoute";
import type { Plan } from "@/lib/types";

describe("plan routes", () => {
  it("creates a stable readable segment", () => {
    expect(createPlanRouteSlug("Operation Longhaul!", "plan-a8f3c2d1")).toBe(
      "operation-longhaul-a8f3c2d1",
    );
  });

  it("uses a stored slug, while legacy plans retain their raw-id route", () => {
    const plans = {
      "plan-1": { id: "plan-1", name: "Renamed", routeSlug: "original-name-1234" },
      legacy: { id: "legacy", name: "Old plan" },
    } as unknown as Record<string, Plan>;
    expect(planRouteSegment(plans["plan-1"])).toBe("original-name-1234");
    expect(planRouteSegment(plans.legacy)).toBe("legacy");
    expect(findPlanByRouteSegment(plans, "original-name-1234")?.id).toBe("plan-1");
    expect(findPlanByRouteSegment(plans, "legacy")?.id).toBe("legacy");
  });
});

import type { Plan } from "@/lib/types";

/** A stable, human-readable path segment for a plan. */
export function planRouteSegment(plan: Pick<Plan, "id" | "name" | "routeSlug">): string {
  return plan.routeSlug || plan.id;
}

/** Create once when a plan is created; never derive it again after a rename. */
export function createPlanRouteSlug(name: string, id: string): string {
  const label = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "plan";
  const suffix = id.replace(/^plan-/, "").replace(/[^a-z0-9]/gi, "").slice(-8) || "plan";
  return `${label}-${suffix}`;
}

export function findPlanByRouteSegment(
  plans: Record<string, Plan>,
  segment: string | null | undefined,
): Plan | undefined {
  if (!segment) return undefined;
  return Object.values(plans).find(
    (plan) => plan.routeSlug === segment || plan.id === segment,
  );
}

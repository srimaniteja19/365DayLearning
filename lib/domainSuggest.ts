import { z } from "zod";
import DOMAIN_META from "@/data/domains.json";
import { chatStructured } from "@/lib/claude-client";
import {
  type BuilderDomain,
  type BuilderDomainWeight,
  colorForDomainIndex,
  slugifyDomain,
} from "@/lib/planBuilder";
import { parseJsonWithRepair } from "@/lib/planGeneration";
import { ContentError } from "@/lib/providers/errors";

const WEIGHTS = new Set<BuilderDomainWeight>(["small", "medium", "large"]);

const suggestSchema = z.object({
  domains: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.coerce.string().transform((s) => s.trim()),
        weight: z
          .coerce.string()
          .transform((s) => s.toLowerCase())
          .pipe(z.enum(["small", "medium", "large"]))
          .catch("medium"),
      }).transform((d) => ({
        ...d,
        label: d.label || d.id || "Domain",
      })),
    )
    .min(1)
    .max(8)
    .transform((list) => {
      const cleaned = list.filter((d) => d.label.trim());
      return cleaned.length >= 2 ? cleaned.slice(0, 8) : cleaned;
    })
    .refine((list) => list.length >= 2, { message: "Need at least 2 domains" }),
});

const SUGGEST_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["domains"],
  properties: {
    domains: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "weight"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          weight: { type: "string", enum: ["small", "medium", "large"] },
        },
      },
    },
  },
} as const;

const SYSTEM = `You pick learning domains and relative weights for a personal technical study plan.
Never put double-quote characters inside labels. Prefer a structured tool when available.`;

function knownDomainCatalog(): string {
  return Object.entries(DOMAIN_META)
    .map(([id, meta]) => `- ${id}: ${(meta as { label: string }).label}`)
    .join("\n");
}

function resolveDomainId(rawId: string | undefined, label: string): string {
  const known = DOMAIN_META as Record<string, { label: string }>;
  if (rawId && known[rawId]) return rawId;
  const byLabel = Object.entries(known).find(
    ([, meta]) => meta.label.toLowerCase() === label.trim().toLowerCase(),
  );
  if (byLabel) return byLabel[0];
  return slugifyDomain(label);
}

export function normalizeSuggestedDomains(
  raw: Array<{ id?: string; label: string; weight: string }>,
): BuilderDomain[] {
  const seen = new Set<string>();
  const out: BuilderDomain[] = [];
  for (const row of raw) {
    const label = row.label.trim();
    if (!label) continue;
    let id = resolveDomainId(row.id, label);
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seen.add(id);
    const weight = (WEIGHTS.has(row.weight as BuilderDomainWeight)
      ? row.weight
      : "medium") as BuilderDomainWeight;
    const known = (DOMAIN_META as Record<string, { label: string }>)[id];
    out.push({
      id,
      label: known?.label || label,
      weight,
      color: colorForDomainIndex(out.length),
    });
  }
  return out;
}

export async function suggestDomainsFromGoal(opts: {
  goal: string;
  level?: string;
  exclusions?: string[];
  signal?: AbortSignal;
}): Promise<BuilderDomain[]> {
  const goal = opts.goal.trim();
  if (!goal) throw new ContentError("Add a goal first so domains can be suggested.");

  const prompt = `Suggest the domains a learning plan should cover for this goal, with relative weights.

Goal: ${goal}
Learner level: ${opts.level?.trim() || "unspecified"}
${opts.exclusions?.length ? `Exclusions (do not include domains for these):\n${opts.exclusions.map((e) => `- ${e}`).join("\n")}` : ""}

Prefer ids from this catalog when they fit; invent a short new id and label only if the skill is outside it:
${knownDomainCatalog()}

Rules
- Return 3 to 6 domains that matter for the goal. Do not pad with weakly related domains.
- weight is how much of the plan that domain should take: large = primary focus, medium = supporting, small = light coverage.
- At least one domain must be large. Not every domain should be the same weight.
- Skip domains the learner already excludes or that are irrelevant to the goal.
- Do not use double-quote characters inside labels.`;

  const parsed = await chatStructured({
    system: SYSTEM,
    prompt,
    maxTokens: 900,
    temperature: 0.2,
    signal: opts.signal,
    kind: "action",
    schema: suggestSchema,
    structured: {
      name: "submit_domains",
      description: "Submit suggested learning domains and weights.",
      schema: SUGGEST_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    parse: parseJsonWithRepair,
  });

  const domains = normalizeSuggestedDomains(parsed.domains);
  if (domains.length < 2) {
    throw new ContentError("AI returned too few domains. Try again or add them manually.");
  }
  return domains;
}

import { describe, expect, it } from "vitest";
import { normalizeSuggestedDomains } from "@/lib/domainSuggest";

describe("normalizeSuggestedDomains", () => {
  it("maps known catalog ids and assigns colors", () => {
    const domains = normalizeSuggestedDomains([
      { id: "backend-node", label: "Node / Nest", weight: "large" },
      { id: "bogus", label: "Databases", weight: "medium" },
      { label: "Custom GraphQL", weight: "small" },
    ]);
    expect(domains[0]).toMatchObject({ id: "backend-node", label: "Node / Nest", weight: "large" });
    expect(domains[1].id).toBe("databases");
    expect(domains[1].label).toBe("Databases");
    expect(domains[2]).toMatchObject({ id: "custom-graphql", label: "Custom GraphQL", weight: "small" });
    expect(domains[0].color).toBeTruthy();
  });

  it("dedupes colliding ids", () => {
    const domains = normalizeSuggestedDomains([
      { label: "Rust", weight: "large" },
      { label: "Rust", weight: "small" },
    ]);
    expect(domains.map((d) => d.id)).toEqual(["rust", "rust-2"]);
  });
});

import type { CardCategory, CardDefinition, CardTag } from "./cardTypes";

type CardInput = Omit<CardDefinition, "description"> & {
  description?: string;
};

export function defineCard(input: CardInput): CardDefinition {
  return {
    ...input,
    description: input.description ?? input.rulesText,
    tags: input.tags ?? [],
  };
}

export function legacyCard(
  input: Omit<CardDefinition, "category" | "tags" | "rulesText"> &
    Partial<Pick<CardDefinition, "category" | "tags" | "rulesText">>,
): CardDefinition {
  return defineCard({
    category: input.category ?? "creation",
    tags: input.tags ?? [],
    rulesText: input.rulesText ?? input.description,
    ...input,
  });
}

export function growthCardIds(): string[] {
  return ["creeping-wilds", "settlement-spreads", "urban-pressure"];
}

export function isGrowthDefinitionId(definitionId: string): boolean {
  return growthCardIds().includes(definitionId);
}

export function categoryLabel(category: CardCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function frequencyLabel(copies: number): string {
  if (copies >= 3) {
    return "Common";
  }

  if (copies === 2) {
    return "Uncommon";
  }

  return "Rare";
}

export function tagMatchesFilter(
  tags: CardTag[],
  filter: string,
): boolean {
  if (filter === "propagation") {
    return true;
  }

  if (filter === "deck mutation") {
    return tags.includes("rare");
  }

  return tags.includes(filter as CardTag);
}

import type { CardCategory } from "../cards/cardTypes";
import { categoryLabel, frequencyLabel } from "../cards/defineCard";
import { getCardDefinition } from "../cards/cardRegistry";
import {
  getDeckConfiguration,
  normalizeDeckConfigurationId,
  type DeckConfiguration,
} from "../deck/deckConfiguration";
import type { DeckManifestEntry } from "../cards/advancedDeck/advancedDeckManifest";

export type CatalogueFilter =
  | "all"
  | CardCategory
  | "terrain"
  | "settlement"
  | "road"
  | "ruin"
  | "boundary"
  | "propagation"
  | "deck mutation";

function matchesFilter(entry: DeckManifestEntry, filter: CatalogueFilter): boolean {
  if (filter === "all") {
    return true;
  }

  const definition = getCardDefinition(entry.definitionId);

  if (!definition) {
    return false;
  }

  if (
    filter === "creation" ||
    filter === "growth" ||
    filter === "connection" ||
    filter === "transformation" ||
    filter === "destruction" ||
    filter === "recovery" ||
    filter === "expansion" ||
    filter === "deck"
  ) {
    return entry.category === filter;
  }

  if (filter === "propagation") {
    return definition.effects.some((effect) => effect.type === "propagate");
  }

  if (filter === "deck mutation") {
    return (definition.deckMutations?.length ?? 0) > 0;
  }

  return definition.tags.includes(filter);
}

function describeDeckMutation(definitionId: string): string {
  const definition = getCardDefinition(definitionId);

  if (!definition?.deckMutations?.length) {
    return "None";
  }

  return definition.deckMutations
    .map((mutation) => {
      switch (mutation.type) {
        case "retire-self":
          return "Retire self after success";
        case "retire-card":
          return "Retire one selected card";
        case "copy-card":
          return `Copy card to ${mutation.destination}`;
        case "modify-card":
          return `Modify draw pile (${mutation.modification.type})`;
        default:
          return mutation.type;
      }
    })
    .join("; ");
}

function describeFailure(definitionId: string): string {
  const definition = getCardDefinition(definitionId);

  if (!definition) {
    return "Unknown";
  }

  const behaviours = [
    definition.defaultFailureBehaviour,
    ...Object.values(definition.failureBehaviours ?? {}),
  ].filter(Boolean);

  if (behaviours.length === 0) {
    return "Fail";
  }

  return behaviours.map((behaviour) => behaviour!.type).join(", ");
}

export function formatCatalogueEntry(entry: DeckManifestEntry): string {
  const definition = getCardDefinition(entry.definitionId);
  const rules = definition?.rulesText ?? entry.summary;

  return [
    entry.name,
    `Category: ${categoryLabel(entry.category)} (${frequencyLabel(entry.copies)})`,
    `Copies: ${entry.copies}`,
    `Rules: ${rules}`,
    `Failure: ${describeFailure(entry.definitionId)}`,
    `Deck mutation: ${describeDeckMutation(entry.definitionId)}`,
    "",
  ].join("\n");
}

export function formatDeckCatalogue(
  configuration: DeckConfiguration,
  filter: CatalogueFilter = "all",
): string {
  const entries = configuration.manifest.filter((entry) =>
    matchesFilter(entry, filter),
  );

  if (entries.length === 0) {
    return "No cards match this filter.";
  }

  const totalCopies = entries.reduce((sum, entry) => sum + entry.copies, 0);

  return [
    `${configuration.name}`,
    `${configuration.description}`,
    `Showing ${entries.length} definitions (${totalCopies} copies)`,
    "",
    ...entries.map((entry) => formatCatalogueEntry(entry)),
  ].join("\n");
}

export function formatDeckCatalogueForWorld(
  deckConfigurationId: string,
  filter: CatalogueFilter = "all",
): string {
  const normalizedId = normalizeDeckConfigurationId(deckConfigurationId);
  const configuration = getDeckConfiguration(normalizedId);

  if (!configuration) {
    return `Unknown deck configuration: ${deckConfigurationId}`;
  }

  const catalogue = formatDeckCatalogue(configuration, filter);

  if (normalizedId !== deckConfigurationId) {
    return [
      `(Deck configuration "${deckConfigurationId}" is legacy; showing "${normalizedId}".)`,
      catalogue,
    ].join("\n");
  }

  return catalogue;
}

export const CATALOGUE_FILTERS: Array<{ value: CatalogueFilter; label: string }> =
  [
    { value: "all", label: "All" },
    { value: "creation", label: "Creation" },
    { value: "growth", label: "Growth" },
    { value: "connection", label: "Connection" },
    { value: "transformation", label: "Transformation" },
    { value: "destruction", label: "Destruction" },
    { value: "recovery", label: "Recovery" },
    { value: "expansion", label: "Expansion" },
    { value: "deck", label: "Deck mutation" },
    { value: "terrain", label: "Terrain tag" },
    { value: "settlement", label: "Settlement tag" },
    { value: "road", label: "Road tag" },
    { value: "propagation", label: "Propagation" },
  ];

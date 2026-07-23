import type { CardDefinition, CardCategory } from "../cards/cardTypes";
import type { DeckManifestEntry } from "../cards/advancedDeck/advancedDeckManifest";
import { MAX_DECK_MUTATION_COPIES } from "./balanceConfig";

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_CATEGORIES: CardCategory[] = [
  "creation",
  "growth",
  "connection",
  "transformation",
  "destruction",
  "recovery",
  "expansion",
  "deck",
];

function validateDefinitionStructure(
  definition: CardDefinition,
  errors: string[],
  warnings: string[],
): void {
  if (!definition.rulesText?.trim()) {
    errors.push(`"${definition.id}" is missing rulesText.`);
  }

  if (!definition.category || !VALID_CATEGORIES.includes(definition.category)) {
    errors.push(`"${definition.id}" has an invalid category "${definition.category}".`);
  }

  if (!Array.isArray(definition.tags)) {
    errors.push(`"${definition.id}" must declare tags (may be empty).`);
  }

  if (!definition.target) {
    errors.push(`"${definition.id}" is missing a target definition.`);
  }

  if (!definition.effects || definition.effects.length === 0) {
    errors.push(`"${definition.id}" must declare at least one effect.`);
  }

  for (const mutation of definition.deckMutations ?? []) {
    if (mutation.type === "copy-card") {
      const count =
        mutation.count.type === "fixed"
          ? mutation.count.value
          : mutation.count.type === "random-range"
            ? mutation.count.maximum
            : 1;

      if (count > MAX_DECK_MUTATION_COPIES) {
        warnings.push(
          `"${definition.id}" copy-card mutation exceeds recommended maximum of ${MAX_DECK_MUTATION_COPIES}.`,
        );
      }
    }
  }

  if (
    definition.deckMutations?.some((mutation) => mutation.type === "retire-self") &&
    !definition.defaultFailureBehaviour &&
    !definition.failureBehaviours?.selection
  ) {
    warnings.push(
      `"${definition.id}" retires itself but has no explicit discard failure on selection.`,
    );
  }
}

export function validateDeckDefinitions(
  definitions: CardDefinition[],
  manifest: DeckManifestEntry[],
): DeckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const definitionMap = new Map(definitions.map((entry) => [entry.id, entry]));
  const manifestIds = manifest.map((entry) => entry.definitionId);
  const duplicateManifestIds = manifestIds.filter(
    (id, index) => manifestIds.indexOf(id) !== index,
  );

  if (duplicateManifestIds.length > 0) {
    errors.push(
      `Manifest contains duplicate definition IDs: ${[...new Set(duplicateManifestIds)].join(", ")}.`,
    );
  }

  const definitionIds = definitions.map((entry) => entry.id);
  const duplicateDefinitionIds = definitionIds.filter(
    (id, index) => definitionIds.indexOf(id) !== index,
  );

  if (duplicateDefinitionIds.length > 0) {
    errors.push(
      `Registry contains duplicate definition IDs: ${[...new Set(duplicateDefinitionIds)].join(", ")}.`,
    );
  }

  for (const definition of definitions) {
    validateDefinitionStructure(definition, errors, warnings);
  }

  for (const entry of manifest) {
    if (entry.copies <= 0) {
      errors.push(`Manifest entry "${entry.definitionId}" must have positive copies.`);
    }

    if (!entry.summary?.trim()) {
      warnings.push(`Manifest entry "${entry.definitionId}" is missing a summary.`);
    }

    if (!VALID_CATEGORIES.includes(entry.category)) {
      errors.push(
        `Manifest entry "${entry.definitionId}" has invalid category "${entry.category}".`,
      );
    }

    const definition = definitionMap.get(entry.definitionId);

    if (!definition) {
      errors.push(
        `Manifest references unknown definition "${entry.definitionId}".`,
      );
      continue;
    }

    if (definition.category !== entry.category) {
      errors.push(
        `Manifest category for "${entry.definitionId}" (${entry.category}) does not match definition (${definition.category}).`,
      );
    }

    if (entry.name !== definition.name) {
      warnings.push(
        `Manifest name for "${entry.definitionId}" differs from definition name.`,
      );
    }

    if (entry.definitionId.startsWith("dev-")) {
      warnings.push(`Manifest includes development card "${entry.definitionId}".`);
    }
  }

  for (const definition of definitions) {
    if (definition.id.startsWith("dev-") && manifestIds.includes(definition.id)) {
      warnings.push(`Development definition "${definition.id}" appears in the manifest.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

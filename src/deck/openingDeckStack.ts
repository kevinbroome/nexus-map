import type { CardDefinition, CardTag } from "../cards/cardTypes";
import { createSeededRandom } from "../rules/random";
import type { DeckCardInstance } from "./deckTypes";

export const OPENING_DRAW_COUNT = 5;
export const MAX_OPENING_DESTRUCTIVE = 1;

export const OPENING_CARD_TAG_REQUIREMENTS: CardTag[] = [
  "biome-seed",
  "water-seed",
  "settlement-seed",
];

function shuffleInstances(
  instances: DeckCardInstance[],
  seed: string,
): DeckCardInstance[] {
  const random = createSeededRandom(seed);
  const pool = [...instances];
  const shuffled: DeckCardInstance[] = [];

  while (pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    shuffled.push(pool.splice(index, 1)[0]!);
  }

  return shuffled;
}

function instanceMatchesTag(
  instance: DeckCardInstance,
  tag: CardTag,
  definitions: Map<string, CardDefinition>,
): boolean {
  const definition = definitions.get(instance.definitionId);
  return definition?.tags.includes(tag) ?? false;
}

function isDestructiveInstance(
  instance: DeckCardInstance,
  definitions: Map<string, CardDefinition>,
): boolean {
  const definition = definitions.get(instance.definitionId);
  return definition?.tags.includes("destructive") ?? false;
}

function pullInstanceForTag(
  pool: DeckCardInstance[],
  tag: CardTag,
  definitions: Map<string, CardDefinition>,
): DeckCardInstance | undefined {
  const index = pool.findIndex((instance) =>
    instanceMatchesTag(instance, tag, definitions),
  );

  if (index === -1) {
    return undefined;
  }

  return pool.splice(index, 1)[0];
}

function countDestructive(
  instances: DeckCardInstance[],
  definitions: Map<string, CardDefinition>,
): number {
  return instances.filter((instance) =>
    isDestructiveInstance(instance, definitions),
  ).length;
}

function swapOutExtraDestructive(
  opening: DeckCardInstance[],
  pool: DeckCardInstance[],
  definitions: Map<string, CardDefinition>,
): void {
  while (
    countDestructive(opening, definitions) > MAX_OPENING_DESTRUCTIVE &&
    opening.length > 0
  ) {
    const destructiveIndex = opening.findIndex((instance) =>
      isDestructiveInstance(instance, definitions),
    );

    if (destructiveIndex === -1) {
      break;
    }

    const replacementIndex = pool.findIndex(
      (instance) => !isDestructiveInstance(instance, definitions),
    );

    if (replacementIndex === -1) {
      break;
    }

    const [destructive] = opening.splice(destructiveIndex, 1);
    const [replacement] = pool.splice(replacementIndex, 1);
    opening.push(replacement!);
    pool.push(destructive!);
  }
}

export function applyOpeningDrawGuarantees(
  drawPile: DeckCardInstance[],
  definitions: CardDefinition[],
  seed: string,
): DeckCardInstance[] {
  if (drawPile.length <= OPENING_DRAW_COUNT) {
    return drawPile;
  }

  const definitionMap = new Map(definitions.map((entry) => [entry.id, entry]));
  const pool = shuffleInstances(drawPile, seed);
  const opening: DeckCardInstance[] = [];

  for (const tag of OPENING_CARD_TAG_REQUIREMENTS) {
    if (opening.some((instance) => instanceMatchesTag(instance, tag, definitionMap))) {
      continue;
    }

    const pulled = pullInstanceForTag(pool, tag, definitionMap);

    if (pulled) {
      opening.push(pulled);
    }
  }

  while (opening.length < OPENING_DRAW_COUNT && pool.length > 0) {
    opening.push(pool.shift()!);
  }

  swapOutExtraDestructive(opening, pool, definitionMap);

  while (opening.length < OPENING_DRAW_COUNT && pool.length > 0) {
    opening.push(pool.shift()!);
  }

  return [...opening, ...pool];
}

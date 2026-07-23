import type { CardDefinition } from "../cards/cardTypes";
import { createSeededRandom } from "../rules/random";
import type { DeckCardInstance, DeckState } from "./deckTypes";
import { cloneDeckState } from "./deckTypes";
import { createDeckInstanceId, validateUniqueInstanceIds } from "./instanceIds";

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

export function createInitialDeck(
  definitions: CardDefinition[],
  seed: string,
  turn = 0,
): DeckState {
  const playable = definitions.filter((card) => !card.id.startsWith("dev-"));
  const instances: DeckCardInstance[] = [];
  let index = 0;

  for (const definition of playable) {
    const copies = definition.initialCopies ?? 1;

    for (let copy = 0; copy < copies; copy++) {
      instances.push({
        instanceId: createDeckInstanceId({
          definitionId: definition.id,
          createdTurn: turn,
          initialIndex: index,
        }),
        definitionId: definition.id,
        createdTurn: turn,
        modifications: [],
        tags: [],
      });
      index += 1;
    }
  }

  const duplicateMessages = validateUniqueInstanceIds(instances);

  if (duplicateMessages.length > 0) {
    throw new Error(duplicateMessages.join(" "));
  }

  return {
    drawPile: shuffleInstances(instances, seed),
    discardPile: [],
    retiredPile: [],
    activeInstanceId: undefined,
    shuffleCount: 0,
  };
}

export function createMigrationDeckSeed(world: {
  id: string;
  createdAt: string;
  version: number;
}): string {
  return `migration:v${world.version}:${world.id}:${world.createdAt}`;
}

export function normalizeDeckState(deck: DeckState | undefined, fallbackSeed: string, turn: number, definitions: CardDefinition[]): DeckState {
  if (!deck) {
    return createInitialDeck(definitions, fallbackSeed, turn);
  }

  return cloneDeckState(deck);
}

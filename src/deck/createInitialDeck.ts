import type { CardDefinition } from "../cards/cardTypes";
import type { DeckManifestEntry } from "../cards/advancedDeck/advancedDeckManifest";
import { createSeededRandom } from "../rules/random";
import type { DeckCardInstance, DeckState } from "./deckTypes";
import { cloneDeckState } from "./deckTypes";
import { createDeckInstanceId, validateUniqueInstanceIds } from "./instanceIds";
import { FIRST_ADVANCED_TEST_DECK } from "./deckConfiguration";
import { applyOpeningDrawGuarantees } from "./openingDeckStack";

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

export function createDeckFromConfiguration(
  manifest: DeckManifestEntry[],
  definitions: CardDefinition[],
  seed: string,
  turn = 0,
): DeckState {
  const definitionMap = new Map(definitions.map((entry) => [entry.id, entry]));
  const instances: DeckCardInstance[] = [];
  let index = 0;

  for (const entry of manifest) {
    if (entry.definitionId.startsWith("dev-")) {
      continue;
    }

    const definition = definitionMap.get(entry.definitionId);

    if (!definition) {
      throw new Error(`Unknown card definition "${entry.definitionId}" in deck manifest.`);
    }

    for (let copy = 0; copy < entry.copies; copy++) {
      instances.push({
        instanceId: createDeckInstanceId({
          definitionId: entry.definitionId,
          createdTurn: turn,
          initialIndex: index,
        }),
        definitionId: entry.definitionId,
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
    drawPile: applyOpeningDrawGuarantees(
      shuffleInstances(instances, seed),
      definitions,
      `${seed}:opening`,
    ),
    discardPile: [],
    retiredPile: [],
    activeInstanceId: undefined,
    shuffleCount: 0,
  };
}

export function createInitialDeck(
  definitions: CardDefinition[],
  seed: string,
  turn = 0,
  manifest?: DeckManifestEntry[],
): DeckState {
  if (manifest) {
    return createDeckFromConfiguration(manifest, definitions, seed, turn);
  }

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

export function createDefaultAdvancedDeck(
  definitions: CardDefinition[],
  seed: string,
  turn = 0,
): DeckState {
  return createDeckFromConfiguration(
    FIRST_ADVANCED_TEST_DECK.manifest,
    definitions,
    seed,
    turn,
  );
}

export function createMigrationDeckSeed(world: {
  id: string;
  createdAt: string;
  version: number;
}): string {
  return `migration:v${world.version}:${world.id}:${world.createdAt}`;
}

export function normalizeDeckState(
  deck: DeckState | undefined,
  fallbackSeed: string,
  turn: number,
  definitions: CardDefinition[],
  manifest?: DeckManifestEntry[],
): DeckState {
  if (!deck) {
    return createInitialDeck(definitions, fallbackSeed, turn, manifest);
  }

  return cloneDeckState(deck);
}

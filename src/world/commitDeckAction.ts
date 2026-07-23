import { cards } from "../cards/cardDefinitions";
import { createInitialDeck, createMigrationDeckSeed } from "../deck/createInitialDeck";
import type { DeckCardInstance } from "../deck/deckTypes";
import { discardActiveCard, drawCard } from "../deck/deckOperations";
import { getActiveInstance } from "../deck/deckQueries";
import { persistCommittedWorld } from "../persistence/persistCommittedWorld";
import { createRandomSeed } from "../rules/random";
import type { WorldState } from "./worldTypes";

export type DeckCommitResult = {
  world: WorldState;
  message: string;
  drawnInstance?: DeckCardInstance;
};

function buildShuffleSeed(world: WorldState): string {
  const latestActionId = world.history.at(-1)?.id ?? "start";
  return `${world.id}:${world.deck.shuffleCount}:${latestActionId}`;
}

export async function commitDrawCard(
  world: WorldState,
  randomSeed: string = createRandomSeed(),
): Promise<DeckCommitResult> {
  void randomSeed;
  const drawResult = drawCard(world.deck, buildShuffleSeed(world));

  if (!drawResult.ok || !drawResult.drawnInstance) {
    throw new Error(drawResult.messages.join("\n") || "The card could not be drawn.");
  }

  const updatedWorld: WorldState = {
    ...world,
    deck: drawResult.deck,
    updatedAt: new Date().toISOString(),
  };

  try {
    await persistCommittedWorld(updatedWorld, {
      failureMessage: "The draw could not be saved. The deck was not changed.",
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("The draw could not be saved. The deck was not changed.");
  }

  return {
    world: updatedWorld,
    drawnInstance: drawResult.drawnInstance,
    message: `Drew a card from the deck.`,
  };
}

export async function commitDiscardActiveCard(
  world: WorldState,
): Promise<DeckCommitResult> {
  if (!world.deck.activeInstanceId) {
    throw new Error("No active card to discard.");
  }

  const discardResult = discardActiveCard(world.deck);

  if (!discardResult.ok) {
    throw new Error(discardResult.messages.join("\n") || "The card could not be discarded.");
  }

  const updatedWorld: WorldState = {
    ...world,
    deck: discardResult.deck,
    updatedAt: new Date().toISOString(),
  };

  try {
    await persistCommittedWorld(updatedWorld, {
      failureMessage: "The discard could not be saved. The deck was not changed.",
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("The discard could not be saved. The deck was not changed.");
  }

  return {
    world: updatedWorld,
    message: "Active card discarded.",
  };
}

export function getActiveCardInstance(world: WorldState): DeckCardInstance | undefined {
  return getActiveInstance(world.deck);
}

export function ensureWorldHasDeck(world: WorldState): WorldState {
  if (world.deck) {
    return world;
  }

  return {
    ...world,
    deck: createInitialDeck(
      cards,
      createMigrationDeckSeed({ id: world.id, createdAt: world.createdAt, version: 4 }),
      world.turn,
    ),
  };
}

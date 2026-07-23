import type { CardDefinition } from "../cards/cardTypes";
import { getCardDefinition as lookupCardDefinition } from "../cards/cardRegistry";
import type { WorldState } from "../world/worldTypes";
import type { DeckCardInstance, DeckState, EffectiveCardDefinition } from "./deckTypes";
import { cloneDeckInstance } from "./deckTypes";

export function getAllDeckInstances(deck: DeckState): DeckCardInstance[] {
  const active = deck.activeInstance ? [deck.activeInstance] : [];
  return [
    ...deck.drawPile,
    ...deck.discardPile,
    ...deck.retiredPile,
    ...active,
  ];
}

export function getActiveInstance(deck: DeckState): DeckCardInstance | undefined {
  if (deck.activeInstance) {
    return cloneDeckInstance(deck.activeInstance);
  }

  if (!deck.activeInstanceId) {
    return undefined;
  }

  return getAllDeckInstances(deck).find(
    (entry) => entry.instanceId === deck.activeInstanceId,
  );
}

export function getInstancePile(
  deck: DeckState,
  instanceId: string,
): "draw" | "discard" | "retired" | "active" | null {
  if (deck.activeInstanceId === instanceId) {
    return "active";
  }

  if (deck.drawPile.some((entry) => entry.instanceId === instanceId)) {
    return "draw";
  }

  if (deck.discardPile.some((entry) => entry.instanceId === instanceId)) {
    return "discard";
  }

  if (deck.retiredPile.some((entry) => entry.instanceId === instanceId)) {
    return "retired";
  }

  return null;
}

export function getCardDefinition(definitionId: string): CardDefinition | undefined {
  return lookupCardDefinition(definitionId);
}

export function getDeckSummary(deck: DeckState): {
  drawCount: number;
  discardCount: number;
  retiredCount: number;
  activeName: string | null;
  shuffleCount: number;
} {
  const active = getActiveInstance(deck);
  const definition = active ? getCardDefinition(active.definitionId) : undefined;

  return {
    drawCount: deck.drawPile.length,
    discardCount: deck.discardPile.length,
    retiredCount: deck.retiredPile.length,
    activeName: definition?.name ?? null,
    shuffleCount: deck.shuffleCount,
  };
}

export function formatInstanceLabel(
  instance: DeckCardInstance,
  definition?: CardDefinition,
): string {
  const base = definition?.name ?? instance.definitionId;
  const renamed = instance.modifications.find((entry) => entry.type === "rename");

  if (renamed?.type === "rename") {
    return renamed.name;
  }

  return base;
}

export function cloneInstanceList(instances: DeckCardInstance[]): DeckCardInstance[] {
  return instances.map(cloneDeckInstance);
}

export function ensureActiveCardForDefinition(
  world: WorldState,
  definitionId: string,
): WorldState {
  const active = getActiveInstance(world.deck);

  if (active?.definitionId === definitionId) {
    return world;
  }

  if (active) {
    throw new Error(
      `Expected active card "${definitionId}" but "${active.definitionId}" is active.`,
    );
  }

  const drawIndex = world.deck.drawPile.findIndex(
    (entry) => entry.definitionId === definitionId,
  );

  if (drawIndex >= 0) {
    const instance = world.deck.drawPile[drawIndex]!;

    return {
      ...world,
      deck: {
        ...world.deck,
        drawPile: world.deck.drawPile.filter((_, index) => index !== drawIndex),
        activeInstanceId: instance.instanceId,
        activeInstance: cloneDeckInstance(instance),
      },
    };
  }

  const discardIndex = world.deck.discardPile.findIndex(
    (entry) => entry.definitionId === definitionId,
  );

  if (discardIndex >= 0) {
    const instance = world.deck.discardPile[discardIndex]!;

    return {
      ...world,
      deck: {
        ...world.deck,
        discardPile: world.deck.discardPile.filter((_, index) => index !== discardIndex),
        activeInstanceId: instance.instanceId,
        activeInstance: cloneDeckInstance(instance),
      },
    };
  }

  throw new Error(`Card definition "${definitionId}" is not available in the deck.`);
}

export function findEffectiveCardForInstance(
  instance: DeckCardInstance,
): EffectiveCardDefinition | null {
  const definition = getCardDefinition(instance.definitionId);

  if (!definition) {
    return null;
  }

  return {
    ...structuredClone(definition),
    instanceId: instance.instanceId,
    baseDefinitionId: instance.definitionId,
    appliedModifications: instance.modifications.map((entry) => structuredClone(entry)),
    modificationSummary: [],
  };
}

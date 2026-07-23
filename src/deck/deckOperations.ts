import { createSeededRandom } from "../rules/random";
import { MAX_DECK_SIZE } from "./constants";
import type {
  CardCopyContext,
  DeckCardInstance,
  DeckMutationRecord,
  DeckOperationResult,
  DeckState,
} from "./deckTypes";
import { cloneDeckInstance, cloneDeckState } from "./deckTypes";
import { createDeckInstanceId, validateUniqueInstanceIds } from "./instanceIds";

function allInstances(deck: DeckState): DeckCardInstance[] {
  return [...deck.drawPile, ...deck.discardPile, ...deck.retiredPile];
}

function findInstance(deck: DeckState, instanceId: string): DeckCardInstance | undefined {
  return allInstances(deck).find((entry) => entry.instanceId === instanceId);
}

function removeInstanceFromPiles(
  deck: DeckState,
  instanceId: string,
): { deck: DeckState; instance?: DeckCardInstance } {
  const next = cloneDeckState(deck);
  const removeFrom = (pile: DeckCardInstance[]) => {
    const index = pile.findIndex((entry) => entry.instanceId === instanceId);

    if (index >= 0) {
      return pile.splice(index, 1)[0];
    }

    return undefined;
  };

  const removed =
    removeFrom(next.drawPile) ??
    removeFrom(next.discardPile) ??
    removeFrom(next.retiredPile);

  return { deck: next, instance: removed };
}

function validateDeckSize(deck: DeckState): string[] {
  const total =
    deck.drawPile.length +
    deck.discardPile.length +
    deck.retiredPile.length +
    (deck.activeInstanceId ? 1 : 0);

  if (total > MAX_DECK_SIZE) {
    return [`Deck exceeds the maximum size of ${MAX_DECK_SIZE} cards.`];
  }

  return validateUniqueInstanceIds(allInstances(deck));
}

function success(
  deck: DeckState,
  mutations: DeckMutationRecord[] = [],
  extra: Partial<DeckOperationResult> = {},
): DeckOperationResult {
  const messages = validateDeckSize(deck);

  if (messages.length > 0) {
    return {
      ok: false,
      deck,
      messages,
      mutations,
    };
  }

  return {
    ok: true,
    deck,
    messages: [],
    mutations,
    ...extra,
  };
}

export function shuffleDiscardIntoDraw(
  deck: DeckState,
  seed: string,
): DeckOperationResult {
  const next = cloneDeckState(deck);

  if (next.drawPile.length > 0 || next.discardPile.length === 0) {
    return {
      ok: false,
      deck: next,
      messages: ["Discard pile cannot be shuffled into draw in the current state."],
      mutations: [],
    };
  }

  const random = createSeededRandom(seed);
  const pool = [...next.discardPile];
  const shuffled: DeckCardInstance[] = [];

  while (pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    shuffled.push(pool.splice(index, 1)[0]!);
  }

  next.drawPile = shuffled;
  next.discardPile = [];
  next.shuffleCount += 1;

  return success(next, [
    {
      type: "pile-shuffled",
      source: "discard-into-draw",
      resultingOrder: shuffled.map((entry) => entry.instanceId),
      seed,
    },
  ], { shuffled: true, shuffleSeed: seed });
}

export function drawCard(
  deck: DeckState,
  shuffleSeed: string,
): DeckOperationResult {
  if (deck.activeInstanceId) {
    return {
      ok: false,
      deck: cloneDeckState(deck),
      messages: ["A card is already active."],
      mutations: [],
    };
  }

  let next = cloneDeckState(deck);
  const mutations: DeckMutationRecord[] = [];

  if (next.drawPile.length === 0) {
    const shuffleResult = shuffleDiscardIntoDraw(next, shuffleSeed);

    if (!shuffleResult.ok) {
      return {
        ok: false,
        deck: next,
        messages: ["Draw pile is empty and discard pile cannot be reshuffled."],
        mutations: [],
      };
    }

    next = shuffleResult.deck;
    mutations.push(...shuffleResult.mutations);
  }

  const [drawn, ...remaining] = next.drawPile;
  next.drawPile = remaining;
  next.activeInstanceId = drawn?.instanceId;
  next.activeInstance = drawn ? cloneDeckInstance(drawn) : undefined;

  if (!drawn) {
    return {
      ok: false,
      deck: next,
      messages: ["No card could be drawn."],
      mutations,
    };
  }

  return success(next, mutations, { drawnInstance: cloneDeckInstance(drawn) });
}

export function discardActiveCard(deck: DeckState): DeckOperationResult {
  if (!deck.activeInstanceId) {
    return {
      ok: false,
      deck: cloneDeckState(deck),
      messages: ["No active card to discard."],
      mutations: [],
    };
  }

  const next = cloneDeckState(deck);
  const active = next.activeInstance ?? findInstance(next, next.activeInstanceId!);

  if (!active) {
    return {
      ok: false,
      deck: next,
      messages: ["Active card instance could not be found."],
      mutations: [],
    };
  }

  next.discardPile = [...next.discardPile, cloneDeckInstance(active)];
  const instanceId = next.activeInstanceId;
  next.activeInstanceId = undefined;
  next.activeInstance = undefined;

  return success(next, [
    {
      type: "active-card-moved",
      instanceId: instanceId!,
      destination: "discard",
    },
  ]);
}

export function commitActiveCard(deck: DeckState): DeckOperationResult {
  return discardActiveCard(deck);
}

export function retireCard(deck: DeckState, instanceId: string): DeckOperationResult {
  let next = cloneDeckState(deck);
  let instance: DeckCardInstance | undefined;

  if (next.activeInstanceId === instanceId && next.activeInstance) {
    instance = cloneDeckInstance(next.activeInstance);
    next.activeInstanceId = undefined;
    next.activeInstance = undefined;
  } else {
    const removed = removeInstanceFromPiles(next, instanceId);
    next = removed.deck;
    instance = removed.instance;
  }

  if (!instance) {
    return {
      ok: false,
      deck: cloneDeckState(deck),
      messages: [`Card instance "${instanceId}" could not be retired.`],
      mutations: [],
    };
  }

  next.retiredPile = [...next.retiredPile, cloneDeckInstance(instance)];

  return success(next, [{ type: "card-retired", instanceId }]);
}

export function addCardInstance(
  deck: DeckState,
  instance: DeckCardInstance,
  destination: import("./deckTypes").DeckDestination,
): DeckOperationResult {
  const next = cloneDeckState(deck);
  const copy = cloneDeckInstance(instance);

  switch (destination) {
    case "draw-top":
      next.drawPile = [copy, ...next.drawPile];
      break;
    case "draw-bottom":
      next.drawPile = [...next.drawPile, copy];
      break;
    case "draw-random": {
      const index = Math.floor(Math.random() * (next.drawPile.length + 1));
      next.drawPile = [
        ...next.drawPile.slice(0, index),
        copy,
        ...next.drawPile.slice(index),
      ];
      break;
    }
    case "discard":
      next.discardPile = [...next.discardPile, copy];
      break;
    case "retired":
      next.retiredPile = [...next.retiredPile, copy];
      break;
    default: {
      const unreachable: never = destination;
      return {
        ok: false,
        deck: next,
        messages: [`Unsupported destination: ${String(unreachable)}`],
        mutations: [],
      };
    }
  }

  return success(next, [
    { type: "card-added", instance: copy, destination },
  ]);
}

export function copyCardInstance(
  deck: DeckState,
  sourceInstanceId: string,
  context: CardCopyContext,
  destination: import("./deckTypes").DeckDestination,
): DeckOperationResult {
  const source = findInstance(deck, sourceInstanceId);

  if (!source) {
    return {
      ok: false,
      deck: cloneDeckState(deck),
      messages: [`Source instance "${sourceInstanceId}" was not found.`],
      mutations: [],
    };
  }

  const copy: DeckCardInstance = {
    ...cloneDeckInstance(source),
    instanceId: createDeckInstanceId({
      definitionId: source.definitionId,
      createdTurn: context.turn,
      createdByActionId: context.actionId,
      copySequence: context.copySequenceStart ?? 0,
    }),
    createdTurn: context.turn,
    createdByActionId: context.actionId,
    modifications: source.modifications.map((entry) => structuredClone(entry)),
    tags: [...source.tags],
  };

  const addResult = addCardInstance(deck, copy, destination);

  if (!addResult.ok) {
    return addResult;
  }

  return success(addResult.deck, [
    ...(addResult.mutations ?? []),
    {
      type: "card-copied",
      sourceInstanceId,
      createdInstanceIds: [copy.instanceId],
      destination,
    },
  ]);
}

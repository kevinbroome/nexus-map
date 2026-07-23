import type { CardDefinition } from "../cards/cardTypes";
import { resolveNumber } from "../rules/targeting/numbers";
import type { TargetResolutionContext } from "../rules/targeting/types";
import { createSeededRandom } from "../rules/random";
import { MAX_CARD_COPIES_PER_ACTION } from "./constants";
import {
  copyCardInstance,
  retireCard,
  shuffleDiscardIntoDraw,
} from "./deckOperations";
import type {
  CardCopyContext,
  CardModification,
  DeckCardInstance,
  DeckDestination,
  DeckMutationDefinition,
  DeckMutationRecord,
  DeckState,
} from "./deckTypes";
import { cloneDeckInstance, cloneDeckState } from "./deckTypes";
import { createDeckInstanceId } from "./instanceIds";
import { getCardDefinition } from "./deckQueries";
import { resolveDeckCardSelector, type SelectorContext } from "./selectors";

export type DeckMutationContext = {
  deck: DeckState;
  card: CardDefinition;
  activeInstanceId: string;
  turn: number;
  actionId: string;
  randomSeed: string;
  resolvedValues: Record<string, unknown>;
  numberContext: TargetResolutionContext;
  previousPlayedInstanceId?: string;
};

export type DeckMutationApplyResult = {
  ok: boolean;
  deck: DeckState;
  mutations: DeckMutationRecord[];
  messages: string[];
};

function insertAtDestination(
  deck: DeckState,
  instance: DeckCardInstance,
  destination: DeckDestination,
  randomSeed: string,
  resolvedValues: Record<string, unknown>,
  mutationKey: string,
): DeckState {
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
      const random = createSeededRandom(`${randomSeed}:${mutationKey}:insert`);
      const index = Math.floor(random() * (next.drawPile.length + 1));
      next.drawPile = [
        ...next.drawPile.slice(0, index),
        copy,
        ...next.drawPile.slice(index),
      ];
      resolvedValues[`${mutationKey}.drawIndex`] = index;
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
      throw new Error(`Unsupported destination: ${String(unreachable)}`);
    }
  }

  return next;
}

function modifyInstanceInDeck(
  deck: DeckState,
  instanceId: string,
  apply: (instance: DeckCardInstance) => DeckCardInstance,
): DeckState {
  const mapPile = (pile: DeckCardInstance[]) =>
    pile.map((entry) =>
      entry.instanceId === instanceId ? apply(cloneDeckInstance(entry)) : entry,
    );

  const next = cloneDeckState(deck);
  next.drawPile = mapPile(next.drawPile);
  next.discardPile = mapPile(next.discardPile);
  next.retiredPile = mapPile(next.retiredPile);

  return next;
}

function selectorContext(
  context: DeckMutationContext,
  key: string,
): SelectorContext {
  return {
    activeInstanceId: context.activeInstanceId,
    previousPlayedInstanceId: context.previousPlayedInstanceId,
    randomSeed: context.randomSeed,
    resolvedValues: context.resolvedValues,
    selectorKey: key,
  };
}

export function applyDeckMutationDefinition(
  mutation: DeckMutationDefinition,
  context: DeckMutationContext,
  mutationIndex: number,
): DeckMutationApplyResult {
  const key = `deck.mutation.${mutationIndex}`;
  let deck = cloneDeckState(context.deck);
  const mutations: DeckMutationRecord[] = [];

  switch (mutation.type) {
    case "retire-self": {
      const retireResult = retireCard(deck, context.activeInstanceId);

      if (!retireResult.ok) {
        return {
          ok: false,
          deck,
          mutations,
          messages: retireResult.messages,
        };
      }

      return {
        ok: true,
        deck: retireResult.deck,
        mutations: [...retireResult.mutations],
        messages: [],
      };
    }

    case "return-self": {
      const instance = deck.activeInstance;

      if (!instance || !deck.activeInstanceId) {
        return {
          ok: false,
          deck,
          mutations,
          messages: ["Active card could not be returned."],
        };
      }

      deck = cloneDeckState(deck);
      deck.activeInstanceId = undefined;
      deck.activeInstance = undefined;

      const destination: DeckDestination =
        mutation.destination === "draw-top" || mutation.destination === "draw-bottom"
          ? mutation.destination
          : "discard";

      deck = insertAtDestination(
        deck,
        instance,
        destination,
        context.randomSeed,
        context.resolvedValues,
        key,
      );

      mutations.push({
        type: "active-card-moved",
        instanceId: instance.instanceId,
        destination,
      });

      return { ok: true, deck, mutations, messages: [] };
    }

    case "retire-card": {
      const selected = resolveDeckCardSelector(
        deck,
        mutation.selector,
        selectorContext(context, key),
      );

      if (selected.instanceIds.length === 0) {
        return { ok: false, deck, mutations, messages: selected.messages };
      }

      for (const instanceId of selected.instanceIds) {
        const result = retireCard(deck, instanceId);

        if (!result.ok) {
          return { ok: false, deck, mutations: [...mutations, ...result.mutations], messages: result.messages };
        }

        deck = result.deck;
        mutations.push(...result.mutations);
      }

      return { ok: true, deck, mutations, messages: [] };
    }

    case "copy-card": {
      const countResult = resolveNumber(
        mutation.count,
        context.numberContext,
        `${key}.count`,
        { minimum: 1, requirePositive: true },
      );

      if (countResult.error) {
        return { ok: false, deck, mutations, messages: [countResult.error] };
      }

      Object.assign(context.resolvedValues, countResult.resolvedValues);

      if (countResult.value > MAX_CARD_COPIES_PER_ACTION) {
        return {
          ok: false,
          deck,
          mutations,
          messages: [`Cannot copy more than ${MAX_CARD_COPIES_PER_ACTION} cards per action.`],
        };
      }

      const selected = resolveDeckCardSelector(
        deck,
        mutation.selector,
        selectorContext(context, key),
      );

      if (selected.instanceIds.length === 0) {
        return { ok: false, deck, mutations, messages: selected.messages };
      }

      const sourceId = selected.instanceIds[0]!;
      const createdIds: string[] = [];

      for (let index = 0; index < countResult.value; index++) {
        const copyContext: CardCopyContext = {
          turn: context.turn,
          actionId: context.actionId,
          randomSeed: context.randomSeed,
          copySequenceStart: index,
        };
        const result = copyCardInstance(deck, sourceId, copyContext, mutation.destination);

        if (!result.ok) {
          return { ok: false, deck, mutations: [...mutations, ...result.mutations], messages: result.messages };
        }

        deck = result.deck;
        mutations.push(...result.mutations);
        const copied = result.mutations.find((entry) => entry.type === "card-copied");

        if (copied?.type === "card-copied") {
          createdIds.push(...copied.createdInstanceIds);
        }
      }

      mutations.push({
        type: "card-copied",
        sourceInstanceId: sourceId,
        createdInstanceIds: createdIds,
        destination: mutation.destination,
      });

      return { ok: true, deck, mutations, messages: [] };
    }

    case "add-card": {
      const definition = getCardDefinition(mutation.definitionId);

      if (!definition) {
        return {
          ok: false,
          deck,
          mutations,
          messages: [`Unknown card definition "${mutation.definitionId}".`],
        };
      }

      const countResult = resolveNumber(
        mutation.count,
        context.numberContext,
        `${key}.count`,
        { minimum: 1, requirePositive: true },
      );

      if (countResult.error) {
        return { ok: false, deck, mutations, messages: [countResult.error] };
      }

      Object.assign(context.resolvedValues, countResult.resolvedValues);

      for (let index = 0; index < countResult.value; index++) {
        const instance: DeckCardInstance = {
          instanceId: createDeckInstanceId({
            definitionId: mutation.definitionId,
            createdTurn: context.turn,
            createdByActionId: context.actionId,
            copySequence: index,
          }),
          definitionId: mutation.definitionId,
          createdTurn: context.turn,
          createdByActionId: context.actionId,
          modifications: [],
          tags: [],
        };

        deck = insertAtDestination(
          deck,
          instance,
          mutation.destination,
          context.randomSeed,
          context.resolvedValues,
          `${key}.${index}`,
        );
        mutations.push({
          type: "card-added",
          instance,
          destination: mutation.destination,
        });
      }

      return { ok: true, deck, mutations, messages: [] };
    }

    case "modify-card": {
      const selected = resolveDeckCardSelector(
        deck,
        mutation.selector,
        selectorContext(context, key),
      );

      if (selected.instanceIds.length === 0) {
        return { ok: false, deck, mutations, messages: selected.messages };
      }

      for (const instanceId of selected.instanceIds) {
        deck = modifyInstanceInDeck(deck, instanceId, (instance) => ({
          ...instance,
          modifications: [...instance.modifications, structuredClone(mutation.modification)],
        }));
        mutations.push({
          type: "card-modified",
          instanceId,
          modification: structuredClone(mutation.modification),
        });
      }

      return { ok: true, deck, mutations, messages: [] };
    }

    case "remove-modification": {
      const selected = resolveDeckCardSelector(
        deck,
        mutation.selector,
        selectorContext(context, key),
      );

      if (selected.instanceIds.length === 0) {
        return { ok: false, deck, mutations, messages: selected.messages };
      }

      for (const instanceId of selected.instanceIds) {
        const removed: CardModification[] = [];
        deck = modifyInstanceInDeck(deck, instanceId, (instance) => {
          const kept = instance.modifications.filter((entry) => {
            const shouldRemove =
              mutation.modificationType === undefined ||
              entry.type === mutation.modificationType;

            if (shouldRemove) {
              removed.push(structuredClone(entry));
              return false;
            }

            return true;
          });

          return { ...instance, modifications: kept };
        });

        if (removed.length > 0) {
          mutations.push({ type: "modification-removed", instanceId, removed });
        }
      }

      return { ok: true, deck, mutations, messages: [] };
    }

    case "shuffle": {
      if (mutation.source === "discard-into-draw") {
        const shuffleSeed = `${context.randomSeed}:${key}:shuffle:${deck.shuffleCount}`;
        const result = shuffleDiscardIntoDraw(deck, shuffleSeed);

        if (!result.ok) {
          return { ok: false, deck, mutations, messages: result.messages };
        }

        return {
          ok: true,
          deck: result.deck,
          mutations: [...result.mutations],
          messages: [],
        };
      }

      return {
        ok: false,
        deck,
        mutations,
        messages: ["Shuffling the draw pile alone is not supported yet."],
      };
    }

    default: {
      const unreachable: never = mutation;
      return {
        ok: false,
        deck,
        mutations,
        messages: [`Unsupported deck mutation: ${String(unreachable)}`],
      };
    }
  }
}

export function applyDeckMutations(
  definitions: DeckMutationDefinition[] | undefined,
  context: DeckMutationContext,
): DeckMutationApplyResult {
  if (!definitions || definitions.length === 0) {
    return { ok: true, deck: context.deck, mutations: [], messages: [] };
  }

  let deck = cloneDeckState(context.deck);
  const mutations: DeckMutationRecord[] = [];
  const messages: string[] = [];

  definitions.forEach((definition, index) => {
    const result = applyDeckMutationDefinition(definition, { ...context, deck }, index);

    if (!result.ok) {
      messages.push(...result.messages);
      return;
    }

    deck = result.deck;
    mutations.push(...result.mutations);
  });

  if (messages.length > 0) {
    return { ok: false, deck: context.deck, mutations: [], messages };
  }

  return { ok: true, deck, mutations, messages: [] };
}

export function buildEffectiveDefinitionSummary(
  effective: import("./deckTypes").EffectiveCardDefinition,
): Record<string, unknown> {
  return {
    instanceId: effective.instanceId,
    baseDefinitionId: effective.baseDefinitionId,
    name: effective.name,
    modificationSummary: effective.modificationSummary,
    appliedModificationCount: effective.appliedModifications.length,
  };
}

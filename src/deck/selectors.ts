import { createSeededRandom, pickRandomItems } from "../rules/random";
import type { DeckCardInstance, DeckCardSelector, DeckState } from "./deckTypes";
import { getActiveInstance, getAllDeckInstances } from "./deckQueries";

export type SelectorContext = {
  activeInstanceId?: string;
  previousPlayedInstanceId?: string;
  randomSeed: string;
  resolvedValues: Record<string, unknown>;
  selectorKey: string;
};

export function resolveDeckCardSelector(
  deck: DeckState,
  selector: DeckCardSelector,
  context: SelectorContext,
): { instanceIds: string[]; messages: string[] } {
  const all = getAllDeckInstances(deck);

  switch (selector.type) {
    case "self": {
      if (!context.activeInstanceId) {
        return { instanceIds: [], messages: ["No active card for self selector."] };
      }

      const exists = all.some(
        (entry) => entry.instanceId === context.activeInstanceId,
      );

      if (!exists) {
        return {
          instanceIds: [],
          messages: ["Self card instance is not present in the deck."],
        };
      }

      return { instanceIds: [context.activeInstanceId], messages: [] };
    }

    case "active-card": {
      const active = getActiveInstance(deck);

      if (!active) {
        return { instanceIds: [], messages: ["No active card instance."] };
      }

      return { instanceIds: [active.instanceId], messages: [] };
    }

    case "previously-played-card": {
      if (!context.previousPlayedInstanceId) {
        return {
          instanceIds: [],
          messages: ["No previously played card is available."],
        };
      }

      return { instanceIds: [context.previousPlayedInstanceId], messages: [] };
    }

    case "definition-id":
      return {
        instanceIds: all
          .filter((entry) => entry.definitionId === selector.definitionId)
          .map((entry) => entry.instanceId),
        messages: [],
      };

    case "instance-id":
      return all.some((entry) => entry.instanceId === selector.instanceId)
        ? { instanceIds: [selector.instanceId], messages: [] }
        : { instanceIds: [], messages: [`Instance "${selector.instanceId}" not found.`] };

    case "random-from-draw": {
      const pool = deck.drawPile.map((entry) => entry.instanceId);

      if (pool.length === 0) {
        return { instanceIds: [], messages: ["Draw pile is empty."] };
      }

      const random = createSeededRandom(`${context.randomSeed}:${context.selectorKey}:draw`);
      const [picked] = pickRandomItems(pool, 1, random);
      context.resolvedValues[`${context.selectorKey}.selected`] = picked;
      return { instanceIds: picked ? [picked] : [], messages: [] };
    }

    case "random-from-discard": {
      const pool = deck.discardPile.map((entry) => entry.instanceId);

      if (pool.length === 0) {
        return { instanceIds: [], messages: ["Discard pile is empty."] };
      }

      const random = createSeededRandom(`${context.randomSeed}:${context.selectorKey}:discard`);
      const [picked] = pickRandomItems(pool, 1, random);
      context.resolvedValues[`${context.selectorKey}.selected`] = picked;
      return { instanceIds: picked ? [picked] : [], messages: [] };
    }

    case "random-from-any-active-pile": {
      const pool = [...deck.drawPile, ...deck.discardPile].map((entry) => entry.instanceId);

      if (pool.length === 0) {
        return { instanceIds: [], messages: ["No cards in draw or discard piles."] };
      }

      const random = createSeededRandom(`${context.randomSeed}:${context.selectorKey}:any`);
      const [picked] = pickRandomItems(pool, 1, random);
      context.resolvedValues[`${context.selectorKey}.selected`] = picked;
      return { instanceIds: picked ? [picked] : [], messages: [] };
    }

    case "tag":
      return {
        instanceIds: all
          .filter((entry) => entry.tags.includes(selector.tag))
          .map((entry) => entry.instanceId),
        messages: [],
      };

    case "highest-magnitude":
    case "lowest-magnitude":
      return {
        instanceIds: [],
        messages: [`Selector "${selector.type}" is not supported yet.`],
      };

    default: {
      const unreachable: never = selector;
      return {
        instanceIds: [],
        messages: [`Unsupported selector: ${String(unreachable)}`],
      };
    }
  }
}

export function findDeckInstance(
  deck: DeckState,
  instanceId: string,
): DeckCardInstance | undefined {
  return getAllDeckInstances(deck).find((entry) => entry.instanceId === instanceId);
}

import { describe, expect, it } from "vitest";
import { ADVANCED_DECK_CARDS } from "../cards/advancedDeck/advancedDeckCards";
import {
  FIRST_ADVANCED_TEST_DECK_MANIFEST,
  getManifestTotalCopies,
} from "../cards/advancedDeck/advancedDeckManifest";
import { getAllCardDefinitions } from "../cards/cardRegistry";
import type { CardCategory } from "../cards/cardTypes";
import {
  createDeckFromConfiguration,
  createInitialDeck,
} from "../deck/createInitialDeck";
import { FIRST_ADVANCED_TEST_DECK, DEFAULT_DECK_CONFIGURATION_ID } from "../deck/deckConfiguration";
import { checkFreshWorldViability } from "../deck/deckViability";
import { simulateDeck } from "../deck/simulateDeck";
import { validateDeckDefinitions } from "../deck/validateDeck";
import { createTestWorld } from "../world/worldState";

const EXPECTED_COPY_COUNTS: Record<string, number> = {
  "green-beginning": 3,
  "first-foundations": 3,
  "stone-rising": 2,
  "creeping-wilds": 3,
  "settlement-spreads": 2,
  "urban-pressure": 2,
  "the-road-between": 3,
  "the-long-road": 1,
  crossroads: 1,
  "the-flood-comes": 2,
  "the-waters-recede": 1,
  "desert-wind": 2,
  "the-land-breaks": 1,
  "settlement-abandoned": 2,
  "road-blocked": 1,
  "the-chasm-marches": 1,
  "the-emptying": 1,
  reclamation: 1,
  "green-through-stone": 1,
  "the-old-road-holds": 1,
  "edge-of-the-known": 2,
  "new-country": 1,
  "echo-of-the-wild": 1,
  "forgotten-instruction": 1,
  "the-law-changes": 1,
};

const REQUIRED_CATEGORIES: CardCategory[] = [
  "creation",
  "growth",
  "connection",
  "transformation",
  "destruction",
  "recovery",
  "expansion",
  "deck",
];

describe("first advanced test deck", () => {
  const definitions = getAllCardDefinitions();

  describe("deck composition", () => {
    it("contains forty total copies across twenty-five unique cards", () => {
      expect(getManifestTotalCopies()).toBe(40);
      expect(FIRST_ADVANCED_TEST_DECK_MANIFEST).toHaveLength(25);
      expect(ADVANCED_DECK_CARDS).toHaveLength(25);
    });

    it("matches the specified copy distribution", () => {
      for (const entry of FIRST_ADVANCED_TEST_DECK_MANIFEST) {
        expect(entry.copies).toBe(EXPECTED_COPY_COUNTS[entry.definitionId]);
      }
    });

    it("uses unique manifest definition IDs", () => {
      const ids = FIRST_ADVANCED_TEST_DECK_MANIFEST.map((entry) => entry.definitionId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("provides summaries for every manifest entry", () => {
      for (const entry of FIRST_ADVANCED_TEST_DECK_MANIFEST) {
        expect(entry.summary.trim().length).toBeGreaterThan(0);
      }
    });

    it("passes deck definition validation", () => {
      const result = validateDeckDefinitions(definitions, FIRST_ADVANCED_TEST_DECK_MANIFEST);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it("builds a deterministic deck from the manifest", () => {
      const left = createDeckFromConfiguration(
        FIRST_ADVANCED_TEST_DECK.manifest,
        definitions,
        "advanced-deck-seed",
        0,
      );
      const right = createDeckFromConfiguration(
        FIRST_ADVANCED_TEST_DECK.manifest,
        definitions,
        "advanced-deck-seed",
        0,
      );

      expect(left.drawPile.map((entry) => entry.instanceId)).toEqual(
        right.drawPile.map((entry) => entry.instanceId),
      );
      expect(left.drawPile).toHaveLength(40);
    });

    it("wires the default deck configuration", () => {
      expect(FIRST_ADVANCED_TEST_DECK.id).toBe("first-advanced-test-deck");
      expect(FIRST_ADVANCED_TEST_DECK.manifest).toBe(FIRST_ADVANCED_TEST_DECK_MANIFEST);
    });
  });

  describe("fresh-world behaviour", () => {
    it("can play at least one card immediately on an empty world", () => {
      const world = createTestWorld("Fresh", 5, 5);
      const viability = checkFreshWorldViability(
        world,
        definitions,
        FIRST_ADVANCED_TEST_DECK_MANIFEST,
      );

      expect(viability.viable).toBe(true);
      expect(viability.immediatelyPlayable).toContain("green-beginning");
    });

    it("treats water, road, and ruin cards as temporarily blocked with safe failures", () => {
      const world = createTestWorld("Fresh", 5, 5);
      const viability = checkFreshWorldViability(
        world,
        definitions,
        FIRST_ADVANCED_TEST_DECK_MANIFEST,
      );

      expect(viability.temporarilyBlocked).toEqual(
        expect.arrayContaining([
          "the-flood-comes",
          "the-waters-recede",
          "the-old-road-holds",
          "reclamation",
          "road-blocked",
        ]),
      );
    });
  });

  describe("simulation", () => {
    it("runs deterministically for the same seed", () => {
      const world = createTestWorld(
        "Sim",
        7,
        7,
        0,
        0,
        DEFAULT_DECK_CONFIGURATION_ID,
      );

      const left = simulateDeck(world, 12, "sim-seed-a");
      const right = simulateDeck(world, 12, "sim-seed-a");

      expect(left.metrics).toEqual(right.metrics);
      expect(left.history.map((entry) => entry.cardId)).toEqual(
        right.history.map((entry) => entry.cardId),
      );
    });

    it("completes turns without stalling on a starter world", () => {
      const world = createTestWorld(
        "Sim",
        7,
        7,
        0,
        0,
        DEFAULT_DECK_CONFIGURATION_ID,
      );
      const result = simulateDeck(world, 20, "sim-seed-b");

      expect(result.metrics.turnsCompleted).toBeGreaterThan(0);
      expect(result.stoppedReason).not.toBe("stalled");
      expect(
        result.metrics.successfulPlays + result.metrics.discardedPlays,
      ).toBe(result.metrics.turnsCompleted);
    });

    it("keeps propagation and deck mutation activity bounded", () => {
      const world = createTestWorld(
        "Sim",
        7,
        7,
        0,
        0,
        DEFAULT_DECK_CONFIGURATION_ID,
      );
      const result = simulateDeck(world, 30, "sim-seed-c");

      expect(result.metrics.maxPropagationSteps).toBeLessThanOrEqual(40);
      expect(result.finalWorld.deck.drawPile.length).toBeLessThanOrEqual(40);
    });
  });

  describe("card coverage", () => {
    it("represents every deck category in the manifest", () => {
      const categories = new Set(
        FIRST_ADVANCED_TEST_DECK_MANIFEST.map((entry) => entry.category),
      );

      for (const category of REQUIRED_CATEGORIES) {
        expect(categories.has(category)).toBe(true);
      }
    });

    it("registers every advanced card with rules text and tags", () => {
      for (const card of ADVANCED_DECK_CARDS) {
        expect(card.rulesText.trim().length).toBeGreaterThan(0);
        expect(card.tags.length).toBeGreaterThan(0);
        expect(card.category).toBeTruthy();
      }
    });

    it("falls back to legacy initial deck creation without a manifest", () => {
      const deck = createInitialDeck(definitions, "legacy-seed", 0);
      expect(deck.drawPile.length).toBeGreaterThanOrEqual(39);
    });
  });
});

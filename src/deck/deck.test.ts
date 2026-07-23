import { describe, expect, it } from "vitest";
import { cards } from "../cards/cardDefinitions";
import {
  applyDeckMutations,
  buildEffectiveDefinitionSummary,
} from "../deck/deckMutations";
import { createInitialDeck, createMigrationDeckSeed } from "../deck/createInitialDeck";
import { cloneDeckState } from "../deck/deckTypes";
import {
  discardActiveCard,
  drawCard,
  retireCard,
  shuffleDiscardIntoDraw,
} from "../deck/deckOperations";
import { ensureActiveCardForDefinition } from "../deck/deckQueries";
import { getActiveInstance } from "../deck/deckQueries";
import { resolveEffectiveCardDefinition } from "../deck/effectiveCard";
import { parseWorld, serializeWorld } from "../persistence/worldMigration";
import {
  buildCardFailure,
  resolveCardFailureChain,
} from "../rules/failure/resolveFailure";
import { canCommitProposal, proposeCardPlay } from "../rules/proposeCardPlay";
import { createTestWorld } from "../world/worldState";
import type { WorldState } from "../world/worldTypes";
import { commitDiscardActiveCard, commitDrawCard } from "../world/commitDeckAction";
import { commitWorldAction } from "../world/commitWorldAction";

function drawUntilActive(world: WorldState): WorldState {
  const result = drawCard(
    world.deck,
    `${world.id}:${world.deck.shuffleCount}:test`,
  );

  if (!result.ok || !result.drawnInstance) {
    throw new Error(result.messages.join("\n"));
  }

  return {
    ...world,
    deck: result.deck,
  };
}

describe("deck creation and persistence", () => {
  it("creates a deterministic initial deck", () => {
    const left = createInitialDeck(cards, "seed-a", 0);
    const right = createInitialDeck(cards, "seed-a", 0);

    expect(left.drawPile.map((entry) => entry.instanceId)).toEqual(
      right.drawPile.map((entry) => entry.instanceId),
    );
  });

  it("creates unique instance ids for multiple copies", () => {
    const multiDeck = createInitialDeck(
      [
        {
          ...cards[0]!,
          id: "copy-test",
          initialCopies: 3,
        },
      ],
      "copy-seed",
      0,
    );

    const ids = multiDeck.drawPile.map((entry) => entry.instanceId);
    expect(new Set(ids).size).toBe(3);
  });

  it("migrates older saves without reshuffling version 5 decks", () => {
    const world = createTestWorld("Migration", 3, 3);
    const json = serializeWorld(world);
    const loaded = parseWorld(json);

    expect(loaded.version).toBe(5);
    expect(loaded.deck.drawPile.map((entry) => entry.instanceId)).toEqual(
      world.deck.drawPile.map((entry) => entry.instanceId),
    );
  });

  it("creates a deck for version 4 saves during migration", () => {
    const legacy = {
      version: 4,
      id: "legacy-world",
      name: "Legacy",
      turn: 2,
      tiles: createTestWorld("Legacy", 2, 2).tiles,
      settlementRegions: {},
      travelRoutes: {},
      history: [],
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    };

    const migrated = parseWorld(JSON.stringify(legacy));
    const expectedSeed = createMigrationDeckSeed({
      id: legacy.id,
      createdAt: legacy.createdAt,
      version: 4,
    });

    expect(migrated.deck.drawPile.length).toBeGreaterThan(0);
    expect(
      createInitialDeck(cards, expectedSeed, legacy.turn).drawPile.map(
        (entry) => entry.instanceId,
      ),
    ).toEqual(migrated.deck.drawPile.map((entry) => entry.instanceId));
  });
});

describe("drawing and discarding", () => {
  it("draw moves one card into active state", () => {
    const world = createTestWorld("Draw", 3, 3);
    const result = drawCard(world.deck, "draw-seed");

    expect(result.ok).toBe(true);
    expect(result.deck.activeInstanceId).toBeTruthy();
    expect(result.deck.drawPile).toHaveLength(world.deck.drawPile.length - 1);
  });

  it("drawing with an active card fails", () => {
    const world = drawUntilActive(createTestWorld("Active", 3, 3));
    const result = drawCard(world.deck, "draw-seed");

    expect(result.ok).toBe(false);
  });

  it("discard moves active card to discard without advancing turn", () => {
    let world = drawUntilActive(createTestWorld("Discard", 3, 3));
    const turn = world.turn;
    const result = discardActiveCard(world.deck);

    expect(result.ok).toBe(true);
    expect(result.deck.activeInstanceId).toBeUndefined();
    expect(result.deck.discardPile).toHaveLength(1);
    world = { ...world, deck: result.deck };
    expect(world.turn).toBe(turn);
  });

  it("reshuffles discard deterministically when draw pile is empty", () => {
    let deck = createInitialDeck(
      [{ ...cards[0]!, id: "solo", initialCopies: 1 }],
      "solo-seed",
      0,
    );
    const first = deck.drawPile[0]!;
    deck = drawCard(deck, "seed-1").deck;
    deck = discardActiveCard(deck).deck;
    const shuffled = shuffleDiscardIntoDraw(deck, "shuffle-seed");

    expect(shuffled.ok).toBe(true);
    expect(shuffled.deck.drawPile).toHaveLength(1);
    expect(shuffled.deck.drawPile[0]?.instanceId).toBe(first.instanceId);
  });

  it("retired cards never re-enter the draw pile on shuffle", () => {
    let deck = createInitialDeck(
      [{ ...cards[0]!, id: "retire-test", initialCopies: 1 }],
      "retire-seed",
      0,
    );
    const instanceId = deck.drawPile[0]!.instanceId;
    deck = drawCard(deck, "seed").deck;
    deck = retireCard(deck, instanceId).deck;
    deck = { ...deck, discardPile: [{ ...deck.drawPile[0]! }] };
    deck.drawPile = [];

    const shuffled = shuffleDiscardIntoDraw(deck, "shuffle-seed");
    expect(shuffled.deck.retiredPile.some((entry) => entry.instanceId === instanceId)).toBe(
      true,
    );
  });
});

describe("effective definitions", () => {
  it("applies magnitude modifications without mutating base definitions", () => {
    const base = cards.find((card) => card.id === "creeping-wilds-ii");

    if (!base) {
      throw new Error("Missing test card.");
    }

    const instance = {
      instanceId: "test-instance",
      definitionId: base.id,
      createdTurn: 0,
      modifications: [{ type: "magnitude-adjustment" as const, amount: 2 }],
      tags: [],
    };

    const before = structuredClone(base);
    const result = resolveEffectiveCardDefinition(base, instance);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const propagate = result.definition.effects.find((effect) => effect.type === "propagate");

    expect(propagate?.type).toBe("propagate");
    if (propagate?.type === "propagate" && propagate.magnitude.type === "fixed") {
      expect(propagate.magnitude.value).toBe(8);
    }

    expect(base).toEqual(before);
    expect(buildEffectiveDefinitionSummary(result.definition).appliedModificationCount).toBe(1);
  });
});

describe("deck mutations", () => {
  it("retire-self removes the active card after default discard", () => {
    let world = ensureActiveCardForDefinition(
      createTestWorld("Retire", 4, 4),
      "the-last-flood",
    );
    const activeId = world.deck.activeInstanceId!;

    world = {
      ...world,
      tiles: {
        ...world.tiles,
        "1,1": {
          ...world.tiles["1,1"]!,
          terrain: "water",
        },
      },
    };

    const proposal = proposeCardPlay(world, ["1,1"], "retire-seed");

    expect(proposal.valid).toBe(true);
    expect(proposal.deckChange?.mutations.some((entry) => entry.type === "card-retired")).toBe(
      true,
    );
    expect(proposal.deckChange?.after.retiredPile.some((entry) => entry.instanceId === activeId)).toBe(
      true,
    );
  });

  it("copy-card creates deterministic instance ids", () => {
    const deck = drawUntilActive(createTestWorld("Copy", 3, 3)).deck;
    const card = cards.find((entry) => entry.id === "echo-of-the-wild");

    if (!card) {
      throw new Error("Missing demo card.");
    }

    const result = applyDeckMutations(card.deckMutations, {
      deck: discardActiveCard(deck).deck,
      card,
      activeInstanceId: deck.activeInstanceId!,
      turn: 1,
      actionId: "action-1",
      randomSeed: "copy-seed",
      resolvedValues: {},
      numberContext: {
        world: createTestWorld("Copy", 3, 3),
        card,
        randomSeed: "copy-seed",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.mutations.some((entry) => entry.type === "card-copied")).toBe(true);
  });
});

describe("failure behaviours", () => {
  it("discard failure only changes deck state", () => {
    const world = ensureActiveCardForDefinition(
      createTestWorld("Fail discard", 3, 3),
      "second-attempt",
    );
    const card = cards.find((entry) => entry.id === "second-attempt");

    if (!card) {
      throw new Error("Missing demo card.");
    }

    const failure = buildCardFailure("selection", "No valid target");
    const resolution = resolveCardFailureChain({
      world,
      card: {
        ...card,
        failureBehaviours: { selection: { type: "discard" } },
      },
      selectionTileIds: ["0,0"],
      randomSeed: "discard-seed",
      failure,
      stage: "selection",
    });

    expect(resolution.finalDisposition).toBe("discard");
  });

  it("fallback effect can become committable", () => {
    const world = ensureActiveCardForDefinition(
      createTestWorld("Fallback", 3, 3),
      "lesser-consequence",
    );
    const card = cards.find((entry) => entry.id === "lesser-consequence");

    if (!card) {
      throw new Error("Missing demo card.");
    }

    const resolution = resolveCardFailureChain({
      world,
      card,
      selectionTileIds: ["1,1"],
      randomSeed: "fallback-seed",
      failure: buildCardFailure("propagation", "Propagation failed."),
      stage: "propagation",
    });

    expect(resolution.resolved).toBe(true);
    expect(resolution.finalProposal?.valid).toBe(true);
  });
});

describe("commit integration", () => {
  it("persists draw and discard outside world actions", () => {
    let world = createTestWorld("Persist", 3, 3);
    world = commitDrawCard(world).world;
    expect(getActiveInstance(world.deck)).toBeTruthy();

    world = commitDiscardActiveCard(world).world;
    expect(world.deck.activeInstanceId).toBeUndefined();
    expect(world.history).toHaveLength(0);
  });

  it("stores deck mutations and card instance on successful commit", () => {
    let world = ensureActiveCardForDefinition(
      createTestWorld("Commit", 4, 4),
      "wild-growth",
    );
    world = {
      ...world,
      tiles: {
        ...world.tiles,
        "1,1": {
          ...world.tiles["1,1"]!,
          terrain: "grassland",
        },
      },
    };

    const card = cards.find((entry) => entry.id === "wild-growth");

    if (!card) {
      throw new Error("Missing card.");
    }

    const proposal = proposeCardPlay(world, ["1,1"], "commit-seed");
    const result = commitWorldAction(
      world,
      card,
      ["1,1"],
      proposal.randomSeed,
      proposal,
    );

    expect(result.action?.cardInstanceId).toBeTruthy();
    expect(result.action?.deckMutations.length).toBeGreaterThan(0);
    expect(result.world.deck.activeInstanceId).toBeUndefined();
  });
});

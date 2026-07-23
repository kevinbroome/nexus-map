import { describe, expect, it, vi } from "vitest";
import { cards } from "../cards/cardDefinitions";
import {
  adjacentPrimaryTarget,
  connectedRegionTarget,
  singlePrimaryTileTarget,
  twoEndpointRouteTarget,
} from "../cards/cardTargets";
import type { CardDefinition } from "../cards/cardTypes";
import { getTileId } from "../world/coordinates";
import { createTestWorld } from "../world/worldState";
import { normalizeMapTile } from "../world/tileUtils";
import { createVillageSettlement } from "../world/tileUtils";
import type { WorldAction, WorldState } from "../world/worldTypes";
import { evaluateCondition, evaluateConditions } from "./conditions";
import { proposeAction } from "./engine";
import { applyEffectsToTile } from "./effects";
import { createSeededRandom, pickRandomItems } from "./random";
import { buildTargetResolutionContext, resolveCardTargets } from "./targets";
import { resolveTargets } from "./targeting/resolveTargets";
import { commitWorldAction } from "../world/commitWorldAction";
import * as persistCommittedWorldModule from "../persistence/persistCommittedWorld";
import { parseWorld, serializeWorld } from "../persistence/worldMigration";

function createCard(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: "test-card",
    name: "Test Card",
    description: "Test",
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "forest" }],
    ...overrides,
  };
}

function createContext(
  world: WorldState,
  card: CardDefinition,
  options: {
    primarySelectionId?: string;
    secondarySelectionId?: string;
    randomSeed?: string;
    previousAction?: WorldAction;
  } = {},
) {
  return buildTargetResolutionContext(
    world,
    card,
    {
      mode: "single",
      tileIds: options.primarySelectionId ? [options.primarySelectionId] : [],
      routeOriginTileId: options.primarySelectionId,
      routeDestinationTileId: options.secondarySelectionId,
    },
    options.randomSeed ?? "test-seed",
    options.previousAction,
  );
}

describe("conditions", () => {
  const world = createTestWorld("Test", 3, 3);

  it("accepts valid targets", () => {
    const tile = world.tiles["1,1"]!;

    expect(
      evaluateConditions(world, tile, [{ type: "terrain-is-not", terrain: "water" }])
        .valid,
    ).toBe(true);
  });

  it("rejects invalid targets", () => {
    const flooded = createTestWorld("Test", 2, 2);
    flooded.tiles["0,0"] = normalizeMapTile({
      ...flooded.tiles["0,0"]!,
      terrain: "water",
    });

    expect(
      evaluateConditions(flooded, flooded.tiles["0,0"]!, [
        { type: "has-no-settlement" },
        { type: "terrain-is-not", terrain: "water" },
      ]).valid,
    ).toBe(false);
  });

  it("checks adjacent terrain", () => {
    const worldWithWater = createTestWorld("Test", 3, 3);
    worldWithWater.tiles["1,0"] = normalizeMapTile({
      ...worldWithWater.tiles["1,0"]!,
      terrain: "water",
    });

    expect(
      evaluateCondition(worldWithWater, worldWithWater.tiles["1,1"]!, {
        type: "adjacent-to-terrain",
        terrain: "water",
      }),
    ).toBe(true);
  });
});

describe("targets", () => {
  const world = createTestWorld("Test", 4, 4);

  it("resolves a single tile target", () => {
    const card = createCard({ target: singlePrimaryTileTarget() });
    const result = resolveCardTargets(world, card, ["2,2"]);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.targetIds).toEqual(["2,2"]);
    }
  });

  it("keeps adjacent targeting within map bounds", () => {
    const card = createCard({ target: adjacentPrimaryTarget(1) });
    const result = resolveCardTargets(world, card, ["0,0"]);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.targetIds.sort()).toEqual(["0,0", "0,1", "1,0"].sort());
      expect(result.targetIds).not.toContain(getTileId(-1, 0));
    }
  });
});

describe("targeting grammar", () => {
  it("resolves primary and secondary selections", () => {
    const world = createTestWorld("Test", 3, 3);
    const card = createCard({ target: twoEndpointRouteTarget(["tile"]) });
    const context = createContext(world, card, {
      primarySelectionId: "0,0",
      secondarySelectionId: "2,2",
    });
    const result = resolveTargets(card.target, context);

    expect(result.valid).toBe(true);
    expect(result.originIds).toEqual(["0,0"]);
    expect(result.destinationIds).toEqual(["2,2"]);
  });

  it("resolves previous action targets from history", () => {
    const world = createTestWorld("Test", 3, 3);
    world.history = [
      {
        id: "action-1",
        sequence: 1,
        cardId: "wild-growth",
        cardName: "Wild",
        targetIds: ["1,1"],
        targetResolution: {
          originIds: ["1,1"],
          destinationIds: [],
          selectedIds: ["1,1"],
          expandedTargetIds: ["1,1"],
          resolvedValues: {},
        },
        appliedAt: new Date().toISOString(),
        changes: [],
        randomSeed: "seed",
        resolvedValues: {},
        turn: 1,
        consequences: [],
        regionChanges: [],
        routeChanges: [],
      },
    ];

    const card = createCard({
      target: {
        origin: { type: "previous-action-target" },
        search: { type: "origin-only" },
        selection: { type: "first" },
      },
    });
    const result = resolveTargets(
      card.target,
      buildTargetResolutionContext(world, card, undefined, "seed", world.history[0]),
    );

    expect(result.originIds).toEqual(["1,1"]);
  });

  it("resolves random existing and boundary tiles deterministically", () => {
    const world = createTestWorld("Test", 3, 3);
    const card = createCard({
      target: {
        origin: { type: "random-existing-tile" },
        search: { type: "origin-only" },
        selection: { type: "first" },
      },
    });
    const first = resolveTargets(
      card.target,
      buildTargetResolutionContext(world, card, undefined, "repeat-seed"),
    );
    const second = resolveTargets(
      card.target,
      buildTargetResolutionContext(world, card, undefined, "repeat-seed"),
    );

    expect(first.originIds).toEqual(second.originIds);

    const boundaryCard = createCard({
      target: {
        origin: { type: "random-boundary-tile" },
        search: { type: "origin-only" },
        selection: { type: "first" },
      },
    });
    const boundary = resolveTargets(
      boundaryCard.target,
      buildTargetResolutionContext(world, boundaryCard, undefined, "repeat-seed"),
    );

    expect(boundary.originIds.length).toBe(1);
    expect(["0,0", "0,1", "0,2", "1,0", "1,2", "2,0", "2,1", "2,2"]).toContain(
      boundary.originIds[0],
    );
  });

  it("resolves exact Manhattan distance as a ring", () => {
    const world = createTestWorld("Test", 5, 5);
    const card = createCard({
      target: {
        origin: { type: "primary-selection" },
        search: {
          type: "exact-distance",
          distance: { type: "fixed", value: 2 },
          metric: "manhattan",
        },
        selection: { type: "all" },
      },
    });
    const result = resolveTargets(
      card.target,
      createContext(world, card, { primarySelectionId: "2,2" }),
    );

    expect(result.filteredCandidateIds.sort()).toEqual(
      ["0,2", "1,1", "1,3", "2,0", "2,4", "3,1", "3,3", "4,2"].sort(),
    );
  });

  it("applies plus, ring, and line expansion", () => {
    const world = createTestWorld("Test", 5, 5);

    const plus = resolveTargets(
      {
        origin: { type: "primary-selection" },
        search: { type: "origin-only" },
        selection: { type: "first" },
        expansion: {
          type: "plus",
          radius: { type: "fixed", value: 1 },
          includeCentre: true,
        },
      },
      createContext(world, createCard(), { primarySelectionId: "2,2" }),
    );

    expect(plus.expandedTargetIds.sort()).toEqual(
      ["1,2", "2,1", "2,2", "2,3", "3,2"].sort(),
    );

    const ring = resolveTargets(
      {
        origin: { type: "primary-selection" },
        search: { type: "origin-only" },
        selection: { type: "first" },
        expansion: {
          type: "ring",
          radius: { type: "fixed", value: 1 },
          metric: "manhattan",
        },
      },
      createContext(world, createCard(), { primarySelectionId: "2,2" }),
    );

    expect(ring.expandedTargetIds.sort()).toEqual(
      ["1,2", "2,1", "2,3", "3,2"].sort(),
    );
  });

  it("fails clearly when not enough candidates are available", () => {
    const world = createTestWorld("Test", 2, 2);
    const card = createCard({
      target: {
        origin: { type: "primary-selection" },
        search: { type: "origin-only" },
        filters: [{ type: "tile-exists" }],
        selection: { type: "count", count: { type: "fixed", value: 3 } },
      },
    });
    const result = resolveTargets(
      card.target,
      createContext(world, card, { primarySelectionId: "0,0" }),
    );

    expect(result.valid).toBe(false);
    expect(result.validationMessages.join(" ")).toMatch(/only 1 candidate/i);
  });
});

describe("effects", () => {
  it("produces immutable updates", () => {
    const world = createTestWorld("Test", 2, 2);
    const before = world.tiles["0,0"]!;

    const modified = applyEffectsToTile(
      world,
      before,
      [{ type: "set-terrain", terrain: "forest" }],
      "seed-1",
      {},
    );

    expect(modified["0,0"]?.terrain).toBe("forest");
    expect(world.tiles["0,0"]?.terrain).toBe("empty");
    expect(before.terrain).toBe("empty");
  });
});

describe("engine", () => {
  it("matches preview and committed results", async () => {
    vi.spyOn(persistCommittedWorldModule, "persistCommittedWorld").mockResolvedValue(undefined);

    const world = createTestWorld("Test", 3, 3);
    const card = cards.find((entry) => entry.id === "wild-growth")!;
    const preview = proposeAction(world, card, ["1,1"], "fixed-seed");
    const committed = await commitWorldAction(
      world,
      card,
      ["1,1"],
      preview.randomSeed,
      preview,
    );

    expect(preview.valid).toBe(true);
    expect(committed.world.tiles["1,1"]?.terrain).toBe("forest");
    expect(committed.action.changes).toEqual([
      ...preview.cardChanges,
      ...preview.consequenceChanges,
    ]);
    expect(committed.action.randomSeed).toBe("fixed-seed");
    expect(committed.action.targetResolution.expandedTargetIds).toEqual(["1,1"]);
    expect(committed.world.history).toHaveLength(1);
  });

  it("uses seeded randomness for neighbouring terrain effects", () => {
    const world = createTestWorld("Test", 3, 3);
    const card = createCard({
      id: "test-random",
      effects: [
        {
          type: "change-neighbouring-terrain",
          terrain: "forest",
          count: 2,
        },
      ],
    });

    const first = proposeAction(world, card, ["1,1"], "repeatable-seed");
    const second = proposeAction(world, card, ["1,1"], "repeatable-seed");

    expect(first).toEqual(second);
    expect(first.resolvedValues).not.toEqual({});
  });

  it("creates exactly one history action per commit", async () => {
    vi.spyOn(persistCommittedWorldModule, "persistCommittedWorld").mockResolvedValue(undefined);

    const world = createTestWorld("Test", 2, 2);
    const card = cards.find((entry) => entry.id === "waters-rise")!;
    const preview = proposeAction(world, card, ["0,0"], "seed-a");
    const committed = await commitWorldAction(
      world,
      card,
      ["0,0"],
      preview.randomSeed,
      preview,
    );

    expect(committed.world.history).toHaveLength(1);
    expect(committed.action.sequence).toBe(1);
  });

  it("previews regional forest spread without affecting water tiles", () => {
    const world = createTestWorld("Test", 3, 3);
    world.tiles["1,1"] = normalizeMapTile({
      ...world.tiles["1,1"]!,
      terrain: "water",
    });
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      terrain: "grassland",
    });

    const card = cards.find((entry) => entry.id === "creeping-wilds-ii")!;
    const preview = proposeAction(world, card, ["0,0"], "regional-seed");

    expect(preview.valid).toBe(true);
    expect(preview.cardChanges.some((change) => change.after.terrain === "water")).toBe(
      false,
    );
    expect(preview.cardChanges.length).toBeGreaterThan(0);
  });

  it("preserves connected region card behaviour", () => {
    const world = createTestWorld("Test", 4, 4);

    for (const tileId of ["1,1", "1,2", "2,1", "2,2"]) {
      world.tiles[tileId] = normalizeMapTile({
        ...world.tiles[tileId]!,
        terrain: "forest",
      });
    }

    const card = cards.find((entry) => entry.id === "wild-consumes-itself")!;
    const preview = proposeAction(world, card, ["1,1"], "forest-seed");

    expect(preview.valid).toBe(true);
    expect(preview.targetResolution?.expandedTargetIds.sort()).toEqual(
      ["1,1", "1,2", "2,1", "2,2"].sort(),
    );
  });

  it("preserves target resolution through export and import", async () => {
    vi.spyOn(persistCommittedWorldModule, "persistCommittedWorld").mockResolvedValue(undefined);

    const world = createTestWorld("Test", 3, 3);
    const card = cards.find((entry) => entry.id === "new-foundations")!;
    world.tiles["1,1"] = normalizeMapTile({
      ...world.tiles["1,1"]!,
      terrain: "grassland",
    });

    const preview = proposeAction(world, card, ["1,1"], "export-seed");
    const committed = await commitWorldAction(
      world,
      card,
      ["1,1"],
      preview.randomSeed,
      preview,
    );
    const imported = parseWorld(serializeWorld(committed.world));

    expect(imported.history[0]?.targetResolution).toEqual(
      committed.action.targetResolution,
    );
  });
});

describe("random", () => {
  it("picks repeatable items from a seed", () => {
    const items = ["a", "b", "c", "d"];
    const first = pickRandomItems(items, 2, createSeededRandom("seed"));
    const second = pickRandomItems(items, 2, createSeededRandom("seed"));

    expect(first).toEqual(second);
  });
});

describe("migrated cards", () => {
  it("resolves nearest settlement origin for village tiles", () => {
    const world = createTestWorld("Test", 5, 5);
    world.tiles["2,2"] = normalizeMapTile({
      ...world.tiles["2,2"]!,
      terrain: "grassland",
      settlement: createVillageSettlement("Alpha"),
    });
    world.tiles["2,4"] = normalizeMapTile({
      ...world.tiles["2,4"]!,
      terrain: "grassland",
      settlement: createVillageSettlement("Beta"),
    });

    const card = cards.find((entry) => entry.id === "distant-foundations")!;
    const preview = proposeAction(world, card, ["2,2"], "distant-seed");

    expect(preview.valid).toBe(true);
    expect(preview.targetResolution?.expandedTargetIds).toHaveLength(1);
    expect(preview.targetResolution?.expandedTargetIds[0]).not.toBe("2,2");
  });

  it("uses connected region targeting for wild consumes itself", () => {
    const card = cards.find((entry) => entry.id === "wild-consumes-itself")!;

    expect(card.target.search?.type).toBe("connected-region");
    expect(card.target).toEqual(connectedRegionTarget("forest"));
  });
});

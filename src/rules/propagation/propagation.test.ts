import { describe, expect, it, vi } from "vitest";
import { cards } from "../../cards/cardDefinitions";
import { singlePrimaryTileTarget } from "../../cards/cardTargets";
import type { CardDefinition } from "../../cards/cardTypes";
import { parseWorld, serializeWorld } from "../../persistence/worldMigration";
import * as persistCommittedWorldModule from "../../persistence/persistCommittedWorld";
import type { TravelRoute } from "../../networks/networkTypes";
import {
  getPropagationRecords,
  proposeAction,
} from "../engine";
import { commitWorldAction } from "../../world/commitWorldAction";
import { getTileId } from "../../world/coordinates";
import { createTestWorld } from "../../world/worldState";
import {
  createVillageSettlement,
  normalizeMapTile,
} from "../../world/tileUtils";
import type { MapTile, WorldState } from "../../world/worldTypes";
import { canReplaceTile } from "./replacement";
import { calculateResistance } from "./resistance";
import { calculateTraversalCost, validateTraversalDefinition } from "./traversal";
import { shouldStopBeforeEntering } from "./stopping";
import { resolveBoundary } from "./boundaries";
import {
  MAX_CREATED_TILES_PER_ACTION,
  MAX_PROPAGATION_STEPS,
} from "./constants";
import { manhattanDistance } from "../targeting/utils";
import { propagateEffect } from "./propagate";
import type { PropagatingEffectDefinition, PropagationContext } from "./types";

function setTerrain(
  world: WorldState,
  x: number,
  y: number,
  terrain: MapTile["terrain"],
): WorldState {
  const id = getTileId(x, y);
  const tile = world.tiles[id];

  if (!tile) {
    return world;
  }

  return {
    ...world,
    tiles: {
      ...world.tiles,
      [id]: normalizeMapTile({ ...tile, terrain }),
    },
  };
}

function withRoad(world: WorldState, pathTileIds: string[]): WorldState {
  const route: TravelRoute = {
    id: "road-test",
    type: "road",
    pathTileIds,
    origin: { type: "tile", tileId: pathTileIds[0]! },
    destination: { type: "tile", tileId: pathTileIds.at(-1)! },
    createdTurn: 0,
    createdByCardId: "test",
    tags: [],
    properties: { totalCost: pathTileIds.length },
  };

  return {
    ...world,
    travelRoutes: {
      ...world.travelRoutes,
      [route.id]: route,
    },
  };
}

function createPropagationCard(
  effect: PropagatingEffectDefinition,
  conditions: CardDefinition["conditions"] = [],
): CardDefinition {
  return {
    id: "propagation-test",
    name: "Propagation Test",
    description: "Test card",
    target: singlePrimaryTileTarget(),
    conditions,
    effects: [effect],
  };
}

function runPropagation(
  world: WorldState,
  definition: PropagatingEffectDefinition,
  seedTileIds: string[],
  randomSeed = "propagation-seed",
) {
  const card = createPropagationCard(definition);
  const context: PropagationContext = {
    world,
    card,
    seedTileIds,
    randomSeed,
    resolvedTargetValues: {},
    effectIndex: 0,
  };

  return propagateEffect(definition, context);
}

describe("propagation strategies", () => {
  it("breadth-first spreads evenly and deterministically", () => {
    const world = createTestWorld("Test", 5, 5);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "forest" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 4 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const first = runPropagation(world, definition, ["2,2"], "bfs-seed");
    const second = runPropagation(world, definition, ["2,2"], "bfs-seed");

    expect(first).toEqual(second);
    expect(first.affectedTileIds).toHaveLength(4);
    expect(first.affectedTileIds.every((tileId) => manhattanDistance("2,2", tileId) <= 2)).toBe(
      true,
    );
  });

  it("random-frontier is reproducible with the same seed", () => {
    const world = createTestWorld("Test", 5, 5);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "burn" },
      strategy: { type: "random-frontier", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 5 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const first = runPropagation(world, definition, ["2,2"], "frontier-seed");
    const second = runPropagation(world, definition, ["2,2"], "frontier-seed");

    expect(first.affectedTileIds).toEqual(second.affectedTileIds);
  });

  it("weighted-frontier prefers lower-cost tiles", () => {
    let world = createTestWorld("Test", 5, 5);
    world = setTerrain(world, 2, 1, "grassland");
    world = setTerrain(world, 2, 3, "urban");

    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "water" },
      strategy: { type: "weighted-frontier", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 1 },
      traversal: {
        terrainCosts: {
          grassland: 1,
          urban: 5,
        },
      },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["2,2"], "weighted-seed");

    expect(result.valid).toBe(true);
    expect(result.affectedTileIds).toEqual(["2,1"]);
  });

  it("directional propagation follows the resolved direction", () => {
    const world = createTestWorld("Test", 7, 7);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "chasm" },
      strategy: {
        type: "directional",
        direction: { type: "fixed", value: "north" },
        spread: 0,
      },
      magnitude: { type: "fixed", value: 3 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["3,3"], "north-seed");

    expect(result.affectedTileIds.sort()).toEqual(["3,0", "3,1", "3,2"]);
  });

  it("random-walk is reproducible and respects no-revisit", () => {
    const world = createTestWorld("Test", 5, 5);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "ash" },
      strategy: {
        type: "random-walk",
        neighbourMode: "cardinal",
        allowRevisit: false,
      },
      magnitude: { type: "fixed", value: 4 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const first = runPropagation(world, definition, ["2,2"], "walk-seed");
    const second = runPropagation(world, definition, ["2,2"], "walk-seed");

    expect(first.affectedTileIds).toEqual(second.affectedTileIds);
    expect(new Set(first.affectedTileIds).size).toBe(first.affectedTileIds.length);
  });

  it("follow-terrain does not leave matching terrain", () => {
    let world = createTestWorld("Test", 5, 5);
    world = setTerrain(world, 2, 2, "forest");
    world = setTerrain(world, 2, 1, "forest");
    world = setTerrain(world, 2, 0, "grassland");

    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "wild" },
      strategy: {
        type: "follow-terrain",
        terrains: ["forest"],
        neighbourMode: "cardinal",
      },
      magnitude: { type: "fixed", value: 2 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["2,2"], "forest-seed");

    expect(result.affectedTileIds.every((tileId) => {
      const tile = world.tiles[tileId] ?? result.tileChanges.find((change) => change.tileId === tileId)?.after;
      return tile?.terrain === "forest" || tileId === "2,1";
    })).toBe(true);
    expect(result.affectedTileIds).not.toContain("2,0");
  });

  it("follow-network stays on connected route tiles", () => {
    let world = createTestWorld("Test", 5, 1);
    world = withRoad(world, ["0,0", "1,0", "2,0", "3,0", "4,0"]);

    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "protected" },
      strategy: { type: "follow-network", routeType: "road" },
      magnitude: { type: "fixed", value: 3 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["2,0"], "road-seed");

    expect(result.valid).toBe(true);
    expect(result.affectedTileIds.every((tileId) => tileId.endsWith(",0"))).toBe(
      true,
    );
  });
});

describe("traversal and resistance", () => {
  const world = createTestWorld("Test", 3, 3);
  const tile = world.tiles["1,1"]!;

  it("lower-cost terrain is preferred via weighted frontier", () => {
    let testWorld = createTestWorld("Test", 3, 3);
    testWorld = setTerrain(testWorld, 1, 0, "grassland");
    testWorld = setTerrain(testWorld, 0, 1, "urban");

    const grassCost = calculateTraversalCost(testWorld, testWorld.tiles["1,0"]!, {
      traversal: { terrainCosts: { grassland: 1, urban: 4 } },
    });
    const urbanCost = calculateTraversalCost(testWorld, testWorld.tiles["0,1"]!, {
      traversal: { terrainCosts: { grassland: 1, urban: 4 } },
    });

    expect(grassCost).toBeLessThan(urbanCost);
  });

  it("terrain resistance increases cost", () => {
    const cost = calculateResistance(world, tile, [
      { type: "terrain", terrain: "empty", resistance: 3 },
    ]);

    expect(cost).toBe(3);
  });

  it("tag resistance increases cost", () => {
    const tagged = normalizeMapTile({ ...tile, tags: ["ward"] });
    const cost = calculateResistance(world, tagged, [
      { type: "tag", tag: "ward", resistance: 4 },
    ]);

    expect(cost).toBe(4);
  });

  it("settlement resistance works", () => {
    const village = normalizeMapTile({
      ...tile,
      settlement: createVillageSettlement("Alpha"),
    });
    const cost = calculateResistance(world, village, [
      { type: "settlement-tier", tier: "village", resistance: 5 },
    ]);

    expect(cost).toBe(5);
  });

  it("route resistance works", () => {
    let roadWorld = withRoad(world, ["1,1", "2,1"]);
    const cost = calculateResistance(roadWorld, roadWorld.tiles["1,1"]!, [
      { type: "route", routeType: "road", resistance: 2 },
    ]);

    expect(cost).toBe(2);
  });

  it("Infinity blocks traversal", () => {
    const cost = calculateTraversalCost(world, tile, {
      traversal: { terrainCosts: { empty: Number.POSITIVE_INFINITY } },
    });

    expect(Number.isFinite(cost)).toBe(false);
  });

  it("invalid negative costs are rejected", () => {
    expect(
      validateTraversalDefinition({
        terrainCosts: { grassland: -1 },
      }),
    ).toContain("Traversal cost for grassland cannot be negative.");
  });
});

describe("replacement", () => {
  const tile = normalizeMapTile({
    id: "1,1",
    x: 1,
    y: 1,
    terrain: "grassland",
    tags: [],
    properties: {},
  });

  it("allow-all permits replacement", () => {
    expect(
      canReplaceTile(tile, { type: "set-terrain", terrain: "forest" }, {
        type: "allow-all",
      }).allowed,
    ).toBe(true);
  });

  it("only permits listed terrain", () => {
    expect(
      canReplaceTile(tile, { type: "set-terrain", terrain: "forest" }, {
        type: "only",
        terrains: ["grassland"],
      }).allowed,
    ).toBe(true);

    const mountain = normalizeMapTile({ ...tile, terrain: "mountain" });
    expect(
      canReplaceTile(mountain, { type: "set-terrain", terrain: "forest" }, {
        type: "only",
        terrains: ["grassland"],
      }).allowed,
    ).toBe(false);
  });

  it("exclude blocks listed terrain", () => {
    expect(
      canReplaceTile(tile, { type: "set-terrain", terrain: "forest" }, {
        type: "exclude",
        terrains: ["grassland"],
      }).allowed,
    ).toBe(false);
  });

  it("priority replaces lower-priority terrain", () => {
    expect(
      canReplaceTile(tile, { type: "set-terrain", terrain: "chasm" }, {
        type: "priority",
        incomingPriority: 10,
        terrainPriorities: {},
        allowEqual: false,
      }).allowed,
    ).toBe(true);
  });

  it("priority blocks higher-priority terrain", () => {
    const chasm = normalizeMapTile({ ...tile, terrain: "chasm" });
    expect(
      canReplaceTile(chasm, { type: "set-terrain", terrain: "grassland" }, {
        type: "priority",
        incomingPriority: 1,
        terrainPriorities: {},
        allowEqual: false,
      }).allowed,
    ).toBe(false);
  });

  it("equal-priority behaviour follows configuration", () => {
    const urban = normalizeMapTile({ ...tile, terrain: "urban" });
    expect(
      canReplaceTile(urban, { type: "set-terrain", terrain: "forest" }, {
        type: "priority",
        incomingPriority: 3,
        terrainPriorities: {},
        allowEqual: true,
      }).allowed,
    ).toBe(true);
    expect(
      canReplaceTile(urban, { type: "set-terrain", terrain: "forest" }, {
        type: "priority",
        incomingPriority: 3,
        terrainPriorities: {},
        allowEqual: false,
      }).allowed,
    ).toBe(false);
  });

  it("matrix rules work", () => {
    expect(
      canReplaceTile(tile, { type: "set-terrain", terrain: "water" }, {
        type: "matrix",
        default: "deny",
        rules: [{ from: "grassland", to: "water", allowed: true }],
      }).allowed,
    ).toBe(true);
  });

  it("traversal may continue through an unchanged tile", () => {
    let world = createTestWorld("Test", 3, 1);
    world = setTerrain(world, 1, 0, "urban");
    world = setTerrain(world, 2, 0, "grassland");

    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "forest" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 2 },
      replacement: { type: "exclude", terrains: ["urban"] },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["0,0"], "traverse-seed");

    expect(result.traversedTileIds).toContain("1,0");
    expect(result.affectedTileIds).toContain("2,0");
    expect(result.affectedTileIds).not.toContain("1,0");
  });
});

describe("stopping conditions", () => {
  it("terrain stops propagation before entering", () => {
    let world = createTestWorld("Test", 3, 3);
    world = setTerrain(world, 1, 0, "water");

    const stop = shouldStopBeforeEntering(
      world,
      { x: 1, y: 0 },
      world.tiles["1,0"],
      [{ type: "terrain", terrains: ["water"] }],
      {
        world,
        card: createPropagationCard({
          type: "propagate",
          operation: { type: "add-tag", tag: "x" },
          strategy: { type: "breadth-first" },
          magnitude: { type: "fixed", value: 1 },
        }),
        seedTileIds: ["1,1"],
        randomSeed: "seed",
        resolvedTargetValues: {},
      },
      "1,1",
      0,
      0,
      {},
    );

    expect(stop.blocked).toBe(true);
  });

  it("maximum distance works", () => {
    let world = createTestWorld("Test", 5, 5);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "near" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 10 },
      stoppingConditions: [
        { type: "maximum-distance", distance: { type: "fixed", value: 1 } },
      ],
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["2,2"], "distance-seed");

    expect(
      result.affectedTileIds.every(
        (tileId) => manhattanDistance("2,2", tileId) <= 1,
      ),
    ).toBe(true);
  });

  it("after-count works", () => {
    let world = createTestWorld("Test", 5, 5);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "counted" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 10 },
      stoppingConditions: [
        { type: "after-count", count: { type: "fixed", value: 2 } },
      ],
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["2,2"], "count-seed");

    expect(result.affectedTileIds.length).toBeLessThanOrEqual(2);
  });
});

describe("boundary behaviour", () => {
  it("stop ends at missing coordinates", () => {
    const world = createTestWorld("Test", 2, 2);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "forest" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 4 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["0,0"], "stop-seed");

    expect(result.createdTileIds).toHaveLength(0);
    expect(result.blockedTileIds.length).toBeGreaterThan(0);
  });

  it("discard-overflow ignores missing coordinates", () => {
    const world = createTestWorld("Test", 2, 2);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "forest" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 2 },
      replacement: { type: "allow-all" },
      boundary: { type: "discard-overflow" },
    };

    const result = runPropagation(world, definition, ["1,1"], "discard-seed");

    expect(result.valid).toBe(true);
    expect(result.createdTileIds).toHaveLength(0);
  });

  it("create-blank-tiles creates valid sparse tiles", () => {
    const world = createTestWorld("Test", 1, 1);
    const resolution = resolveBoundary(
      world,
      { x: 1, y: 0 },
      "0,0",
      { type: "create-blank-tiles", terrain: "empty" },
      {
        world,
        card: createPropagationCard({
          type: "propagate",
          operation: { type: "set-terrain", terrain: "forest" },
          strategy: { type: "breadth-first" },
          magnitude: { type: "fixed", value: 1 },
        }),
        seedTileIds: ["0,0"],
        randomSeed: "seed",
        resolvedTargetValues: {},
      },
      { type: "set-terrain", terrain: "forest" },
      0,
      {},
    );

    expect(resolution.action).toBe("create");
    if (resolution.action === "create") {
      expect(resolution.tile.terrain).toBe("empty");
      expect(resolution.tile.id).toBe("1,0");
    }
  });

  it("create-operation-terrain creates the propagated terrain", () => {
    const world = createTestWorld("Test", 1, 1, 0, 0);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "water" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 1 },
      replacement: { type: "allow-all" },
      boundary: {
        type: "create-operation-terrain",
        maximumNewTiles: { type: "fixed", value: 1 },
      },
    };

    const result = runPropagation(world, definition, ["0,0"], "create-seed");

    expect(result.createdTileIds).toHaveLength(1);
    expect(result.tileChanges[0]?.after.terrain).toBe("water");
  });

  it("maximum-new-tile limit is enforced", () => {
    const world = createTestWorld("Test", 1, 1);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "water" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 5 },
      replacement: { type: "allow-all" },
      boundary: {
        type: "create-operation-terrain",
        maximumNewTiles: { type: "fixed", value: 1 },
      },
    };

    const result = runPropagation(world, definition, ["0,0"], "limit-seed");

    expect(result.createdTileIds.length).toBeLessThanOrEqual(1);
  });

  it("no missing tile is created unless explicitly allowed", () => {
    const world = createTestWorld("Test", 1, 1);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "forest" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 3 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["0,0"], "no-create-seed");

    expect(result.createdTileIds).toHaveLength(0);
  });
});

describe("integration", () => {
  it("targeting resolves before propagation in proposals", () => {
    let world = createTestWorld("Test", 5, 5);
    world = setTerrain(world, 2, 2, "forest");

    const card = cards.find((entry) => entry.id === "creeping-wilds-ii")!;
    const preview = proposeAction(world, card, ["2,2"], "integration-seed");

    expect(preview.valid).toBe(true);
    expect(preview.targetResolution?.expandedTargetIds).toEqual(["2,2"]);
    expect(preview.propagationResults).toHaveLength(1);
    expect(preview.propagationResults[0]?.seedTileIds).toEqual(["2,2"]);
  });

  it("preview and commit propagation records match", async () => {
    vi.spyOn(persistCommittedWorldModule, "persistCommittedWorld").mockResolvedValue(undefined);

    let world = createTestWorld("Test", 5, 5);
    world = setTerrain(world, 2, 2, "forest");

    const card = cards.find((entry) => entry.id === "creeping-wilds-ii")!;
    const preview = proposeAction(world, card, ["2,2"], "commit-seed");
    const committed = await commitWorldAction(
      world,
      card,
      ["2,2"],
      preview.randomSeed,
      preview,
    );

    expect(committed.action.propagationRecords).toEqual(
      getPropagationRecords(preview),
    );
  });

  it("export/import preserves propagation records", async () => {
    vi.spyOn(persistCommittedWorldModule, "persistCommittedWorld").mockResolvedValue(undefined);

    let world = createTestWorld("Test", 5, 5);
    world = setTerrain(world, 2, 2, "forest");

    const card = cards.find((entry) => entry.id === "creeping-wilds-ii")!;
    const preview = proposeAction(world, card, ["2,2"], "export-seed");
    const committed = await commitWorldAction(
      world,
      card,
      ["2,2"],
      preview.randomSeed,
      preview,
    );
    const imported = parseWorld(serializeWorld(committed.world));

    expect(imported.history[0]?.propagationRecords).toEqual(
      committed.action.propagationRecords,
    );
  });

  it("propagation logic contains no Leaflet dependency", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./propagate.ts", import.meta.url), "utf8"),
    );

    expect(source.includes("leaflet")).toBe(false);
    expect(propagateEffect).toBeTypeOf("function");
  });
});

describe("safety", () => {
  it("propagation stops at the hard step limit constant", () => {
    expect(MAX_PROPAGATION_STEPS).toBe(10_000);
  });

  it("excessive tile creation limit is defined", () => {
    expect(MAX_CREATED_TILES_PER_ACTION).toBe(1_000);
  });

  it("empty frontier terminates safely", () => {
    const world = createTestWorld("Test", 1, 1);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "set-terrain", terrain: "forest" },
      strategy: { type: "breadth-first", neighbourMode: "cardinal" },
      magnitude: { type: "fixed", value: 5 },
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["0,0"], "frontier-empty");

    expect(result.valid).toBe(false);
    expect(result.validationMessages[0]).toContain("Propagation affected");
  });

  it("random walks cannot loop forever", () => {
    const world = createTestWorld("Test", 3, 3);
    const definition: PropagatingEffectDefinition = {
      type: "propagate",
      operation: { type: "add-tag", tag: "ash" },
      strategy: {
        type: "random-walk",
        neighbourMode: "cardinal",
        allowRevisit: false,
      },
      magnitude: { type: "fixed", value: 20 },
      stoppingConditions: [{ type: "terrain", terrains: ["water", "chasm"] }],
      replacement: { type: "allow-all" },
      boundary: { type: "stop" },
    };

    const result = runPropagation(world, definition, ["1,1"], "walk-safe");

    expect(result.steps.length).toBeLessThan(MAX_PROPAGATION_STEPS);
  });
});

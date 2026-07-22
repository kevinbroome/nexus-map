import { describe, expect, it, vi } from "vitest";
import { cards } from "../cards/cardDefinitions";
import { parseWorld, serializeWorld } from "../persistence/worldMigration";
import { createEmptySelection } from "../selection/selectionTypes";
import { proposeAction } from "../rules/engine";
import { commitWorldAction } from "../world/commitWorldAction";
import { getTileId } from "../world/coordinates";
import { normalizeMapTile } from "../world/tileUtils";
import { createTestWorld } from "../world/worldState";
import type { WorldState } from "../world/worldTypes";
import { resolveTravelEndpoint } from "./endpoints";
import {
  areEndpointsDirectlyConnected,
  findDisconnectedSettlementEndpoints,
  getConnectedEndpointIds,
  getSettlementConnectionCount,
  isSettlementConnectedToNetwork,
} from "./settlementNetwork";
import {
  getRoute,
  getRoutesThroughTile,
} from "./networkQueries";
import type { TravelEndpoint, TravelRoute } from "./networkTypes";
import { endpointKey } from "./networkTypes";
import { findTravelPath } from "./pathfinding";
import {
  applyTravelRoutesToWorld,
  buildTravelRouteProposal,
} from "./routeCreation";
import { createTravelRouteId } from "./routeId";
import { validateTravelRoute } from "./routeValidation";
import * as worldStorage from "../persistence/worldStorage";

function setTerrain(
  world: WorldState,
  x: number,
  y: number,
  terrain: WorldState["tiles"][string]["terrain"],
): WorldState {
  const id = getTileId(x, y);
  const tile = world.tiles[id];

  if (!tile) {
    throw new Error(`Missing tile ${id}`);
  }

  return {
    ...world,
    tiles: {
      ...world.tiles,
      [id]: normalizeMapTile({ ...tile, terrain }),
    },
  };
}

function withVillage(world: WorldState, x: number, y: number): WorldState {
  const id = getTileId(x, y);
  const tile = world.tiles[id]!;

  return {
    ...world,
    tiles: {
      ...world.tiles,
      [id]: normalizeMapTile({
        ...tile,
        terrain: "grassland",
        settlement: { type: "village", inhospitableTurns: 0 },
      }),
    },
  };
}

function buildRoute(
  world: WorldState,
  origin: TravelEndpoint,
  destination: TravelEndpoint,
  pathTileIds: string[],
): TravelRoute {
  return {
    id: createTravelRouteId("road", origin, destination, pathTileIds),
    type: "road",
    origin,
    destination,
    pathTileIds,
    createdTurn: 1,
    createdByCardId: "test-card",
    tags: ["test"],
    properties: { totalCost: 10, paved: true },
  };
}

function roadSelection(originId: string, destinationId: string) {
  return {
    ...createEmptySelection("two-endpoints"),
    routeOriginTileId: originId,
    routeDestinationTileId: destinationId,
  };
}

describe("route model", () => {
  it("generates deterministic route IDs", () => {
    const origin: TravelEndpoint = { type: "tile", id: "0,0", tileId: "0,0" };
    const destination: TravelEndpoint = { type: "tile", id: "2,0", tileId: "2,0" };
    const path = ["0,0", "1,0", "2,0"];

    const first = createTravelRouteId("road", origin, destination, path);
    const second = createTravelRouteId("road", origin, destination, path);

    expect(first).toBe(second);
    expect(first.startsWith("road-")).toBe(true);
  });

  it("uses the same canonical ID when endpoints are reversed", () => {
    const origin: TravelEndpoint = { type: "tile", id: "0,0", tileId: "0,0" };
    const destination: TravelEndpoint = { type: "tile", id: "2,0", tileId: "2,0" };
    const path = ["0,0", "1,0", "2,0"];

    expect(
      createTravelRouteId("road", origin, destination, path),
    ).toBe(createTravelRouteId("road", destination, origin, path));
  });

  it("keeps terrain unchanged when a route is added", () => {
    let world = createTestWorld("Route terrain", 3, 3);
    world = setTerrain(world, 0, 0, "forest");
    world = setTerrain(world, 1, 0, "grassland");
    world = setTerrain(world, 2, 0, "desert");

    const before = structuredClone(world.tiles);
    const route = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "0,0"),
      resolveTravelEndpoint(world, "tile", "2,0"),
      ["0,0", "1,0", "2,0"],
    );

    world = applyTravelRoutesToWorld(world, [route]);

    expect(world.tiles["0,0"]?.terrain).toBe(before["0,0"]?.terrain);
    expect(world.tiles["1,0"]?.terrain).toBe(before["1,0"]?.terrain);
    expect(world.tiles["2,0"]?.terrain).toBe(before["2,0"]?.terrain);
  });

  it("includes both endpoints in route paths", () => {
    const world = createTestWorld("Endpoints", 3, 1);
    const result = findTravelPath(world, "0,0", "2,0", { routeType: "road" });

    expect(result.valid).toBe(true);
    expect(result.pathTileIds[0]).toBe("0,0");
    expect(result.pathTileIds.at(-1)).toBe("2,0");
  });

  it("allows shared route tiles across different routes", () => {
    let world = createTestWorld("Shared", 4, 1);
    const sharedPath = ["0,0", "1,0", "2,0"];
    const routeA = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "0,0"),
      resolveTravelEndpoint(world, "tile", "2,0"),
      sharedPath,
    );
    world = applyTravelRoutesToWorld(world, [routeA]);

    const routeB = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "2,0"),
      resolveTravelEndpoint(world, "tile", "3,0"),
      ["2,0", "3,0"],
    );

    expect(validateTravelRoute(world, routeB)).toEqual([]);
  });
});

describe("pathfinding", () => {
  it("chooses the shortest low-cost path", () => {
    let world = createTestWorld("Shortest", 5, 1);
    world = setTerrain(world, 2, 0, "forest");

    const result = findTravelPath(world, "0,0", "4,0", { routeType: "road" });

    expect(result.valid).toBe(true);
    expect(result.pathTileIds).toEqual(["0,0", "1,0", "2,0", "3,0", "4,0"]);
  });

  it("costs forest higher than grassland", () => {
    let world = createTestWorld("Forest cost", 3, 1);
    world = setTerrain(world, 1, 0, "forest");

    const throughForest = findTravelPath(world, "0,0", "2,0", { routeType: "road" });
    const aroundForest = findTravelPath(world, "0,0", "2,0", {
      routeType: "road",
      terrainCosts: {
        empty: 1,
        grassland: 1,
        forest: 100,
        water: Number.POSITIVE_INFINITY,
        chasm: Number.POSITIVE_INFINITY,
      },
    });

    expect(throughForest.totalCost).toBeGreaterThan(
      findTravelPath(world, "0,0", "2,0", { routeType: "road" }).totalCost - 1,
    );
    expect(aroundForest.valid).toBe(true);
  });

  it("avoids mountains when a cheaper route exists", () => {
    let world = createTestWorld("Mountain detour", 3, 3);
    world = setTerrain(world, 1, 0, "mountain");
    world = setTerrain(world, 0, 1, "grassland");
    world = setTerrain(world, 1, 1, "grassland");
    world = setTerrain(world, 2, 1, "grassland");

    const result = findTravelPath(world, "0,0", "2,0", { routeType: "road" });

    expect(result.valid).toBe(true);
    expect(result.pathTileIds).not.toContain("1,0");
  });

  it("treats water and chasms as impassable", () => {
    let world = createTestWorld("Impassable", 3, 1);
    world = setTerrain(world, 1, 0, "water");
    expect(findTravelPath(world, "0,0", "2,0", { routeType: "road" }).valid).toBe(
      false,
    );

    world = setTerrain(world, 1, 0, "chasm");
    expect(findTravelPath(world, "0,0", "2,0", { routeType: "road" }).valid).toBe(
      false,
    );
  });

  it("treats missing coordinates as impassable", () => {
    let world = createTestWorld("Sparse", 3, 1);
    world = setTerrain(world, 1, 0, "water");
    const result = findTravelPath(world, "0,0", "2,0", { routeType: "road" });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("No valid path");
  });

  it("supports negative coordinates", () => {
    let world = createTestWorld("Negative", 4, 2, -2, -1);
    world = setTerrain(world, -1, 0, "grassland");

    const result = findTravelPath(world, "-2,0", "0,0", { routeType: "road" });

    expect(result.valid).toBe(true);
    expect(result.pathTileIds[0]).toBe("-2,0");
    expect(result.pathTileIds.at(-1)).toBe("0,0");
  });

  it("returns a clear no-path result", () => {
    const result = findTravelPath(createTestWorld("Blocked", 1, 1), "0,0", "0,0", {
      routeType: "road",
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/differ/i);
  });

  it("uses deterministic tie-breaking", () => {
    let world = createTestWorld("Tie break", 3, 3);
    world = setTerrain(world, 1, 0, "grassland");
    world = setTerrain(world, 0, 1, "grassland");

    const first = findTravelPath(world, "0,0", "2,2", { routeType: "road" });
    const second = findTravelPath(world, "0,0", "2,2", { routeType: "road" });

    expect(first).toEqual(second);
  });

  it("prefers existing roads when the bonus is enabled", () => {
    let world = createTestWorld("Existing bonus", 4, 3);
    world = setTerrain(world, 1, 0, "forest");
    world = setTerrain(world, 2, 0, "grassland");
    world = setTerrain(world, 0, 1, "grassland");
    world = setTerrain(world, 1, 1, "grassland");
    world = setTerrain(world, 2, 1, "grassland");
    world = setTerrain(world, 3, 1, "grassland");

    const withoutBonus = findTravelPath(world, "0,0", "3,0", { routeType: "road" });
    const route = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "0,0"),
      resolveTravelEndpoint(world, "tile", "1,0"),
      ["0,0", "1,0"],
    );
    world = applyTravelRoutesToWorld(world, [route]);

    const withBonus = findTravelPath(world, "0,0", "3,0", {
      routeType: "road",
      allowExistingRoutesBonus: true,
    });

    expect(withoutBonus.valid).toBe(true);
    expect(withBonus.valid).toBe(true);
    expect(withBonus.totalCost).toBeLessThan(withoutBonus.totalCost);
    expect(withBonus.pathTileIds).toContain("1,0");
  });

  it("does not mutate the world", () => {
    const world = createTestWorld("Pure", 3, 1);
    const snapshot = serializeWorld(world);

    findTravelPath(world, "0,0", "2,0", { routeType: "road" });

    expect(serializeWorld(world)).toBe(snapshot);
  });
});

describe("validation", () => {
  it("rejects invalid endpoints and paths", () => {
    const world = createTestWorld("Validate", 3, 1);
    const origin = resolveTravelEndpoint(world, "tile", "0,0");
    const destination = resolveTravelEndpoint(world, "tile", "2,0");

    expect(
      validateTravelRoute(world, {
        ...buildRoute(world, origin, origin, ["0,0", "1,0"]),
        destination: origin,
      }),
    ).toContain("Route endpoints must differ.");

    expect(
      validateTravelRoute(
        world,
        buildRoute(world, origin, destination, ["0,0"]),
      ),
    ).toContain("Route path must contain at least two tiles.");

    expect(
      validateTravelRoute(
        world,
        buildRoute(world, origin, destination, ["0,0", "2,0"]),
      ),
    ).toContain("Every consecutive route tile must be cardinally adjacent.");

    expect(
      validateTravelRoute(
        world,
        buildRoute(world, origin, destination, ["0,0", "1,0", "1,0", "2,0"]),
      ),
    ).toContain('Route path repeats tile "1,0".');
  });

  it("rejects duplicate routes but allows overlapping segments", () => {
    let world = createTestWorld("Duplicate", 4, 1);
    const origin = resolveTravelEndpoint(world, "tile", "0,0");
    const destination = resolveTravelEndpoint(world, "tile", "2,0");
    const route = buildRoute(world, origin, destination, ["0,0", "1,0", "2,0"]);
    world = applyTravelRoutesToWorld(world, [route]);

    expect(validateTravelRoute(world, route)).toContain(
      `Route "${route.id}" already exists.`,
    );

    const overlapping = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "1,0"),
      resolveTravelEndpoint(world, "tile", "3,0"),
      ["1,0", "2,0", "3,0"],
    );

    expect(validateTravelRoute(world, overlapping)).toEqual([]);
  });
});

describe("preview and commit", () => {
  const roadCard = cards.find((card) => card.id === "the-road-between")!;

  it("recalculates preview when endpoints change", () => {
    let world = createTestWorld("Preview", 5, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 3, 0);
    world = withVillage(world, 4, 0);

    const firstPreview = proposeAction(
      world,
      roadCard,
      [],
      "seed",
      roadSelection("0,0", "4,0"),
    );
    const secondPreview = proposeAction(
      world,
      roadCard,
      [],
      "seed",
      roadSelection("0,0", "3,0"),
    );

    expect(firstPreview.valid).toBe(true);
    expect(secondPreview.valid).toBe(true);
    expect(firstPreview.proposedRoutes[0]?.pathTileIds.at(-1)).toBe("4,0");
    expect(secondPreview.proposedRoutes[0]?.pathTileIds.at(-1)).toBe("3,0");
  });

  it("disables apply for invalid routes", () => {
    let world = createTestWorld("Invalid route", 5, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 4, 0);
    world = setTerrain(world, 2, 0, "water");

    const preview = proposeAction(
      world,
      roadCard,
      [],
      "seed",
      roadSelection("0,0", "4,0"),
    );

    expect(preview.valid).toBe(false);
  });

  it("commits the same path that was previewed", () => {
    let world = createTestWorld("Commit path", 5, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 4, 0);

    const preview = proposeAction(
      world,
      roadCard,
      [],
      "seed",
      roadSelection("0,0", "4,0"),
    );
    const saveSpy = vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => {});
    const committed = commitWorldAction(
      world,
      roadCard,
      [],
      preview.randomSeed,
      preview,
      roadSelection("0,0", "4,0"),
    );

    expect(committed.world.travelRoutes).toEqual(
      preview.resultingWorld?.travelRoutes,
    );
    expect(
      Object.values(committed.world.travelRoutes)[0]?.pathTileIds,
    ).toEqual(preview.proposedRoutes[0]?.pathTileIds);
    saveSpy.mockRestore();
  });

  it("increments the turn once and records one history action", () => {
    let world = createTestWorld("Turn", 5, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 4, 0);

    const preview = proposeAction(
      world,
      roadCard,
      [],
      "seed",
      roadSelection("0,0", "4,0"),
    );
    const saveSpy = vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => {});
    const committed = commitWorldAction(
      world,
      roadCard,
      [],
      preview.randomSeed,
      preview,
      roadSelection("0,0", "4,0"),
    );

    expect(committed.world.turn).toBe(1);
    expect(committed.world.history).toHaveLength(1);
    expect(committed.action.routeChanges).toHaveLength(1);
    saveSpy.mockRestore();
  });

  it("leaves the world unchanged when persistence fails", () => {
    let world = createTestWorld("Save fail", 5, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 4, 0);

    const preview = proposeAction(
      world,
      roadCard,
      [],
      "seed",
      roadSelection("0,0", "4,0"),
    );
    vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => {
      throw new Error("save failed");
    });

    expect(() =>
      commitWorldAction(
        world,
        roadCard,
        [],
        preview.randomSeed,
        preview,
        roadSelection("0,0", "4,0"),
      ),
    ).toThrow(/could not be saved/i);
    expect(world.turn).toBe(0);
    expect(Object.keys(world.travelRoutes)).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("migrates older saves with an empty route collection", () => {
    const legacy = {
      version: 3,
      id: "legacy",
      name: "Legacy",
      turn: 0,
      tiles: {
        "0,0": normalizeMapTile({ id: "0,0", x: 0, y: 0, terrain: "grassland" }),
      },
      settlementRegions: {},
      history: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const parsed = parseWorld(JSON.stringify(legacy));

    expect(parsed.version).toBe(4);
    expect(parsed.travelRoutes).toEqual({});
  });

  it("preserves routes and history through export/import", () => {
    let world = createTestWorld("Export routes", 4, 1);
    const origin = resolveTravelEndpoint(world, "tile", "0,0");
    const destination = resolveTravelEndpoint(world, "tile", "3,0");
    const route = buildRoute(world, origin, destination, ["0,0", "1,0", "2,0", "3,0"]);
    world = applyTravelRoutesToWorld(world, [route]);
    world = {
      ...world,
      history: [
        {
          id: "action-1",
          sequence: 1,
          cardId: "the-road-between",
          cardName: "The Road Between",
          targetIds: ["0,0", "3,0"],
          appliedAt: new Date(0).toISOString(),
          changes: [],
          randomSeed: "seed",
          resolvedValues: { route: { pathTileIds: route.pathTileIds } },
          turn: 1,
          consequences: [],
          regionChanges: [],
          routeChanges: [{ type: "created", routeId: route.id, after: route }],
        },
      ],
    };

    const parsed = parseWorld(serializeWorld(world));

    expect(parsed.travelRoutes[route.id]?.tags).toEqual(["test"]);
    expect(parsed.travelRoutes[route.id]?.properties).toEqual({
      totalCost: 10,
      paved: true,
    });
    expect(parsed.history[0]?.routeChanges[0]?.routeId).toBe(route.id);
  });
});

describe("network queries", () => {
  it("finds routes through a tile and connected endpoints", () => {
    let world = createTestWorld("Queries", 5, 1);
    const routeA = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "0,0"),
      resolveTravelEndpoint(world, "tile", "2,0"),
      ["0,0", "1,0", "2,0"],
    );
    const routeB = buildRoute(
      world,
      resolveTravelEndpoint(world, "tile", "2,0"),
      resolveTravelEndpoint(world, "tile", "4,0"),
      ["2,0", "3,0", "4,0"],
    );
    world = applyTravelRoutesToWorld(world, [routeA, routeB]);

    expect(getRoutesThroughTile(world, "2,0")).toHaveLength(2);
    expect(getRoute(world, routeA.id)?.id).toBe(routeA.id);

    const originKey = endpointKey(routeA.origin);
    const farKey = endpointKey(routeB.destination);

    expect(
      areEndpointsDirectlyConnected(world, originKey, endpointKey(routeA.destination)),
    ).toBe(true);
    expect(getConnectedEndpointIds(world, originKey, "road")).toEqual([
      originKey,
      endpointKey(routeA.destination),
      farKey,
    ]);
  });

  it("finds disconnected settlements without looping forever", () => {
    let world = createTestWorld("Disconnected", 5, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 4, 0);

    const disconnected = findDisconnectedSettlementEndpoints(world);

    expect(disconnected).toHaveLength(2);
    expect(getSettlementConnectionCount(world, endpointKey(disconnected[0]!))).toBe(0);
    expect(isSettlementConnectedToNetwork(world, endpointKey(disconnected[0]!))).toBe(
      false,
    );
  });
});

describe("route proposals", () => {
  it("uses the same resolved path in preview and commit data", () => {
    let world = createTestWorld("Resolved path", 4, 1);
    world = withVillage(world, 0, 0);
    world = withVillage(world, 3, 0);

    const effect = {
      type: "create-travel-route" as const,
      routeType: "road" as const,
      destination: { type: "selected-secondary-target" as const },
      preferExistingNetwork: true,
    };
    const proposal = buildTravelRouteProposal(
      world,
      resolveTravelEndpoint(world, "village", "0,0"),
      resolveTravelEndpoint(world, "village", "3,0"),
      effect,
      "the-road-between",
      1,
    );

    expect(proposal.validationMessages).toEqual([]);
    expect(proposal.pathTileIds[0]).toBe("0,0");
    expect(proposal.pathTileIds.at(-1)).toBe("3,0");
    expect(proposal.route.pathTileIds).toEqual(proposal.pathTileIds);
  });
});

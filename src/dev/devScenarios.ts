import { createTravelRouteId } from "../networks/routeId";
import type { TravelEndpoint, TravelRoute } from "../networks/networkTypes";
import { resolveTravelEndpoint } from "../networks/endpoints";
import { getTileId } from "../world/coordinates";
import { buildSettlementHierarchy } from "../worldLaws/settlementHierarchy";
import type { MapTile, WorldState } from "../world/worldTypes";
import { normalizeMapTile } from "../world/tileUtils";
import { createTestWorld } from "../world/worldState";

export type DevScenarioId =
  | "three-villages"
  | "six-villages"
  | "fifteen-villages"
  | "declining-village"
  | "four-ruins"
  | "town-dissolving"
  | "two-villages-grassland"
  | "two-villages-forest"
  | "mountain-detour"
  | "water-separated"
  | "existing-road-network"
  | "negative-coordinate-route"
  | "already-connected"
  | "visual-coastline"
  | "visual-forest-mountain"
  | "visual-urban-hierarchy"
  | "visual-road-network"
  | "visual-ruin-cluster"
  | "visual-chasm-cut"
  | "visual-label-collision";

function setTile(
  world: WorldState,
  x: number,
  y: number,
  patch: Partial<MapTile>,
): WorldState {
  const id = getTileId(x, y);
  const existing = world.tiles[id];

  if (!existing) {
    throw new Error(`Scenario tile ${id} is missing from the test grid.`);
  }

  return {
    ...world,
    tiles: {
      ...world.tiles,
      [id]: normalizeMapTile({ ...existing, ...patch, id, x, y }),
    },
  };
}

function withVillage(
  world: WorldState,
  x: number,
  y: number,
  inhospitableTurns = 0,
  terrain: MapTile["terrain"] = "grassland",
): WorldState {
  return setTile(world, x, y, {
    terrain,
    settlement: { type: "village", inhospitableTurns },
  });
}

function withRuin(world: WorldState, x: number, y: number): WorldState {
  return setTile(world, x, y, {
    terrain: "empty",
    settlement: { type: "ruin", formerType: "village", ruinedAtTurn: 10 },
    tags: ["ruined"],
  });
}

function withTerrain(
  world: WorldState,
  x: number,
  y: number,
  terrain: MapTile["terrain"],
): WorldState {
  return setTile(world, x, y, { terrain });
}

function withRoad(
  world: WorldState,
  origin: TravelEndpoint,
  destination: TravelEndpoint,
  pathTileIds: string[],
): WorldState {
  const route: TravelRoute = {
    id: createTravelRouteId("road", origin, destination, pathTileIds),
    type: "road",
    origin,
    destination,
    pathTileIds,
    createdTurn: 0,
    createdByCardId: "dev-scenario",
    tags: ["dev"],
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

function finalizeScenario(world: WorldState, name: string): WorldState {
  const finalized = {
    ...world,
    name,
    turn: 0,
    settlementRegions: buildSettlementHierarchy(world, 0),
  };

  return {
    ...finalized,
    settlementRegions: buildSettlementHierarchy(finalized, 0),
  };
}

export function createDevScenario(scenarioId: DevScenarioId): WorldState {
  let world = createTestWorld(`Dev: ${scenarioId}`, 8, 8, -2, -2);

  switch (scenarioId) {
    case "three-villages":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 1, 0);
      world = withVillage(world, 2, 0);
      break;

    case "six-villages":
      for (let x = 0; x < 6; x++) {
        world = withVillage(world, x, 0);
      }
      break;

    case "fifteen-villages":
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 3; y++) {
          world = withVillage(world, x, y);
        }
      }
      break;

    case "declining-village":
      world = withVillage(world, 0, 0, 2, "empty");
      break;

    case "four-ruins":
      world = withRuin(world, 0, 0);
      world = withRuin(world, 1, 0);
      world = withRuin(world, 2, 0);
      world = withRuin(world, 3, 0);
      break;

    case "town-dissolving":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 1, 0);
      world = withRuin(world, 2, 0);
      break;

    case "two-villages-grassland":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 4, 0);
      for (let x = 1; x <= 3; x++) {
        world = withTerrain(world, x, 0, "grassland");
      }
      break;

    case "two-villages-forest":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 4, 0);
      world = withTerrain(world, 1, 0, "grassland");
      world = withTerrain(world, 2, 0, "forest");
      world = withTerrain(world, 3, 0, "grassland");
      break;

    case "mountain-detour":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 0, 4);
      world = withTerrain(world, 0, 1, "grassland");
      world = withTerrain(world, 0, 2, "mountain");
      world = withTerrain(world, 0, 3, "grassland");
      for (let y = 0; y <= 4; y++) {
        world = withTerrain(world, 1, y, "grassland");
      }
      break;

    case "water-separated":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 4, 0);
      for (let x = 1; x <= 3; x++) {
        world = withTerrain(world, x, 0, "water");
      }
      break;

    case "existing-road-network":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 2, 0);
      world = withVillage(world, 4, 0);
      for (let x = 0; x <= 4; x++) {
        world = withTerrain(world, x, 0, "grassland");
      }
      world = withRoad(
        world,
        resolveTravelEndpoint(world, "village", "0,0"),
        resolveTravelEndpoint(world, "village", "2,0"),
        ["0,0", "1,0", "2,0"],
      );
      break;

    case "negative-coordinate-route":
      world = withVillage(world, -2, -2);
      world = withVillage(world, 0, 0);
      for (let x = -1; x <= -1; x++) {
        for (let y = -2; y <= -1; y++) {
          world = withTerrain(world, x, y, "grassland");
        }
      }
      world = withTerrain(world, -1, 0, "grassland");
      world = withTerrain(world, 0, -1, "grassland");
      break;

    case "already-connected":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 3, 0);
      for (let x = 0; x <= 3; x++) {
        world = withTerrain(world, x, 0, "grassland");
      }
      world = withRoad(
        world,
        resolveTravelEndpoint(world, "village", "0,0"),
        resolveTravelEndpoint(world, "village", "3,0"),
        ["0,0", "1,0", "2,0", "3,0"],
      );
      break;

    case "visual-coastline":
      for (let x = -2; x <= 5; x++) {
        for (let y = -2; y <= 3; y++) {
          world = withTerrain(world, x, y, x <= 0 ? "water" : "grassland");
        }
      }
      world = withTerrain(world, 2, 1, "water");
      world = withTerrain(world, 3, 2, "forest");
      break;

    case "visual-forest-mountain":
      for (let x = 0; x <= 5; x++) {
        world = withTerrain(world, x, 0, "grassland");
        world = withTerrain(world, x, 1, x <= 2 ? "forest" : "mountain");
        world = withTerrain(world, x, 2, "desert");
      }
      break;

    case "visual-urban-hierarchy":
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 3; y++) {
          world = withVillage(world, x, y, 0, "urban");
        }
      }
      break;

    case "visual-road-network":
      world = withVillage(world, 0, 0);
      world = withVillage(world, 4, 0);
      world = withVillage(world, 2, 3);
      for (let x = 0; x <= 4; x++) {
        world = withTerrain(world, x, 0, "grassland");
      }
      for (let y = 1; y <= 3; y++) {
        world = withTerrain(world, 2, y, "forest");
      }
      world = withRoad(
        world,
        resolveTravelEndpoint(world, "village", "0,0"),
        resolveTravelEndpoint(world, "village", "4,0"),
        ["0,0", "1,0", "2,0", "3,0", "4,0"],
      );
      world = withRoad(
        world,
        resolveTravelEndpoint(world, "village", "2,0"),
        resolveTravelEndpoint(world, "village", "2,3"),
        ["2,0", "2,1", "2,2", "2,3"],
      );
      break;

    case "visual-ruin-cluster":
      world = withRuin(world, 0, 0);
      world = withRuin(world, 1, 0);
      world = withRuin(world, 0, 1);
      world = withTerrain(world, 2, 0, "grassland");
      world = withTerrain(world, 1, 1, "desert");
      break;

    case "visual-chasm-cut":
      for (let x = 0; x <= 5; x++) {
        world = withTerrain(world, x, 0, "urban");
        world = withTerrain(world, x, 1, x === 2 || x === 3 ? "chasm" : "urban");
      }
      break;

    case "visual-label-collision":
      for (let x = 0; x < 6; x++) {
        world = withVillage(world, x, 0, 0, "grassland");
        world = withVillage(world, x, 1, 0, "grassland");
      }
      break;

    default: {
      const unreachable: never = scenarioId;
      throw new Error(`Unknown dev scenario: ${String(unreachable)}`);
    }
  }

  return finalizeScenario(world, `Dev: ${scenarioId}`);
}

export const DEV_SCENARIO_IDS: DevScenarioId[] = [
  "three-villages",
  "six-villages",
  "fifteen-villages",
  "declining-village",
  "four-ruins",
  "town-dissolving",
  "two-villages-grassland",
  "two-villages-forest",
  "mountain-detour",
  "water-separated",
  "existing-road-network",
  "negative-coordinate-route",
  "already-connected",
  "visual-coastline",
  "visual-forest-mountain",
  "visual-urban-hierarchy",
  "visual-road-network",
  "visual-ruin-cluster",
  "visual-chasm-cut",
  "visual-label-collision",
];

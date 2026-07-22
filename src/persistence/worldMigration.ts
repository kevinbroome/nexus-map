import {
  CURRENT_WORLD_VERSION,
  type LegacyWorldStateV1,
  type LegacyWorldStateV2,
  type LegacyWorldStateV3,
  type MapTile,
  type SettlementRegion,
  type TileChange,
  type TravelRoute,
  type WorldAction,
  type WorldState,
} from "../world/worldTypes";
import { buildSettlementHierarchy } from "../worldLaws/settlementHierarchy";
import { normalizeMapTile, normalizeWorldAction } from "../world/tileUtils";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMapTile(value: unknown): value is MapTile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.terrain === "string" &&
    (value.tags === undefined || Array.isArray(value.tags)) &&
    (value.properties === undefined || isRecord(value.properties))
  );
}

function isTileChange(value: unknown): value is TileChange {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.tileId === "string" &&
    (value.before === null || isMapTile(value.before)) &&
    isMapTile(value.after)
  );
}

function isLegacyWorldAction(value: unknown): value is WorldAction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.sequence === "number" &&
    typeof value.cardId === "string" &&
    typeof value.cardName === "string" &&
    Array.isArray(value.targetIds) &&
    typeof value.appliedAt === "string" &&
    Array.isArray(value.changes) &&
    value.changes.every((change) => {
      if (!isRecord(change)) {
        return false;
      }

      return (
        typeof change.tileId === "string" &&
        isMapTile(change.before) &&
        isMapTile(change.after)
      );
    })
  );
}

function isWorldAction(value: unknown): value is WorldAction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.sequence === "number" &&
    typeof value.cardId === "string" &&
    typeof value.cardName === "string" &&
    Array.isArray(value.targetIds) &&
    typeof value.appliedAt === "string" &&
    Array.isArray(value.changes) &&
    value.changes.every(isTileChange) &&
    typeof value.randomSeed === "string" &&
    isRecord(value.resolvedValues) &&
    typeof value.turn === "number" &&
    Array.isArray(value.consequences) &&
    Array.isArray(value.regionChanges) &&
    Array.isArray(value.routeChanges)
  );
}

function isSettlementRegion(value: unknown): value is SettlementRegion {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.tier === "string" &&
    Array.isArray(value.childIds) &&
    Array.isArray(value.memberTileIds) &&
    typeof value.anchorTileId === "string" &&
    typeof value.createdTurn === "number"
  );
}

function isTravelRoute(value: unknown): value is TravelRoute {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    isRecord(value.origin) &&
    isRecord(value.destination) &&
    Array.isArray(value.pathTileIds) &&
    typeof value.createdTurn === "number" &&
    typeof value.createdByCardId === "string" &&
    Array.isArray(value.tags) &&
    isRecord(value.properties)
  );
}

function validateHistorySequence(history: WorldAction[]): void {
  for (let index = 0; index < history.length; index++) {
    const expectedSequence = index + 1;
    const action = history[index];

    if (!action || action.sequence !== expectedSequence) {
      throw new Error("The saved world contains an invalid action sequence.");
    }
  }
}

function normalizeLoadedWorld(data: WorldState): WorldState {
  const tiles = Object.fromEntries(
    Object.entries(data.tiles).map(([tileId, tile]) => [
      tileId,
      normalizeMapTile(tile),
    ]),
  );
  const history = data.history.map((action) => normalizeWorldAction(action));
  const settlementRegions = Object.fromEntries(
    Object.entries(data.settlementRegions ?? {}).filter(([, region]) =>
      isSettlementRegion(region),
    ),
  );
  const travelRoutes = Object.fromEntries(
    Object.entries(data.travelRoutes ?? {}).filter(([, route]) =>
      isTravelRoute(route),
    ),
  );

  return {
    ...data,
    version: 4,
    turn: data.turn ?? 0,
    tiles,
    history,
    settlementRegions,
    travelRoutes,
  };
}

function migrateV1ToV2(data: LegacyWorldStateV1): LegacyWorldStateV2 {
  const tiles = Object.fromEntries(
    Object.entries(data.tiles).map(([tileId, tile]) => [
      tileId,
      normalizeMapTile(tile),
    ]),
  );
  const history = data.history.map((action) =>
    normalizeWorldAction({
      ...action,
      randomSeed: action.randomSeed ?? "",
      resolvedValues: action.resolvedValues ?? {},
      turn: action.turn ?? 0,
      consequences: action.consequences ?? [],
      regionChanges: action.regionChanges ?? [],
      routeChanges: action.routeChanges ?? [],
      changes: action.changes.map((change) => ({
        tileId: change.tileId,
        before: change.before ?? null,
        after: normalizeMapTile(change.after),
      })),
    }),
  );

  return {
    version: 2,
    id: data.id,
    name: data.name,
    tiles,
    history,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function migrateV2ToV3(data: LegacyWorldStateV2): LegacyWorldStateV3 {
  const tiles = Object.fromEntries(
    Object.entries(data.tiles).map(([tileId, tile]) => [
      tileId,
      normalizeMapTile(tile),
    ]),
  );
  const history = data.history.map((action, index) =>
    normalizeWorldAction({
      ...action,
      randomSeed: action.randomSeed ?? "",
      resolvedValues: action.resolvedValues ?? {},
      turn: action.turn ?? index + 1,
      consequences: action.consequences ?? [],
      regionChanges: action.regionChanges ?? [],
      routeChanges: action.routeChanges ?? [],
      changes: action.changes.map((change) => ({
        tileId: change.tileId,
        before: change.before ?? null,
        after: normalizeMapTile(change.after),
      })),
    }),
  );

  const turn = history.length;

  return {
    version: 3,
    id: data.id,
    name: data.name,
    turn,
    tiles,
    settlementRegions: buildSettlementHierarchy(
      {
        version: 4,
        id: data.id,
        name: data.name,
        turn,
        tiles,
        settlementRegions: {},
        travelRoutes: {},
        history,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
      turn,
    ),
    history,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function migrateV3ToV4(data: LegacyWorldStateV3): WorldState {
  const tiles = Object.fromEntries(
    Object.entries(data.tiles).map(([tileId, tile]) => [
      tileId,
      normalizeMapTile(tile),
    ]),
  );
  const history = data.history.map((action) => normalizeWorldAction(action));

  return normalizeLoadedWorld({
    version: 4,
    id: data.id,
    name: data.name,
    turn: data.turn ?? history.length,
    tiles,
    settlementRegions: data.settlementRegions ?? {},
    travelRoutes: {},
    history,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

function validateWorldV4(data: Record<string, unknown>): WorldState {
  if (
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    typeof data.turn !== "number" ||
    !isRecord(data.tiles) ||
    !isRecord(data.settlementRegions) ||
    !isRecord(data.travelRoutes) ||
    !Array.isArray(data.history) ||
    typeof data.createdAt !== "string" ||
    typeof data.updatedAt !== "string"
  ) {
    throw new Error("The saved world is missing required fields.");
  }

  for (const tile of Object.values(data.tiles)) {
    if (!isMapTile(tile)) {
      throw new Error("The saved world contains invalid tile data.");
    }
  }

  for (const region of Object.values(data.settlementRegions)) {
    if (!isSettlementRegion(region)) {
      throw new Error("The saved world contains invalid settlement region data.");
    }
  }

  for (const route of Object.values(data.travelRoutes)) {
    if (!isTravelRoute(route)) {
      throw new Error("The saved world contains invalid travel route data.");
    }
  }

  for (const action of data.history) {
    if (!isWorldAction(action)) {
      throw new Error("The saved world contains invalid history data.");
    }
  }

  validateHistorySequence(data.history as WorldAction[]);

  return normalizeLoadedWorld(data as unknown as WorldState);
}

function validateLegacyWorldV1(data: Record<string, unknown>): LegacyWorldStateV1 {
  if (
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    typeof data.width !== "number" ||
    typeof data.height !== "number" ||
    !isRecord(data.tiles) ||
    !Array.isArray(data.history) ||
    typeof data.createdAt !== "string" ||
    typeof data.updatedAt !== "string"
  ) {
    throw new Error("The saved world is missing required fields.");
  }

  for (const tile of Object.values(data.tiles)) {
    if (!isMapTile(tile)) {
      throw new Error("The saved world contains invalid tile data.");
    }
  }

  for (const action of data.history) {
    if (!isLegacyWorldAction(action)) {
      throw new Error("The saved world contains invalid history data.");
    }
  }

  validateHistorySequence(data.history as WorldAction[]);

  return data as unknown as LegacyWorldStateV1;
}

function validateLegacyWorldV2(data: Record<string, unknown>): LegacyWorldStateV2 {
  if (
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    !isRecord(data.tiles) ||
    !Array.isArray(data.history) ||
    typeof data.createdAt !== "string" ||
    typeof data.updatedAt !== "string"
  ) {
    throw new Error("The saved world is missing required fields.");
  }

  for (const tile of Object.values(data.tiles)) {
    if (!isMapTile(tile)) {
      throw new Error("The saved world contains invalid tile data.");
    }
  }

  for (const action of data.history) {
    if (!isLegacyWorldAction(action)) {
      throw new Error("The saved world contains invalid history data.");
    }
  }

  validateHistorySequence(data.history as WorldAction[]);

  return data as unknown as LegacyWorldStateV2;
}

function validateLegacyWorldV3(data: Record<string, unknown>): LegacyWorldStateV3 {
  if (
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    typeof data.turn !== "number" ||
    !isRecord(data.tiles) ||
    !isRecord(data.settlementRegions) ||
    !Array.isArray(data.history) ||
    typeof data.createdAt !== "string" ||
    typeof data.updatedAt !== "string"
  ) {
    throw new Error("The saved world is missing required fields.");
  }

  return data as unknown as LegacyWorldStateV3;
}

export function parseWorld(json: string): WorldState {
  let data: unknown;

  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("The saved world is not valid JSON.");
  }

  if (!isRecord(data)) {
    throw new Error("The saved world must contain a JSON object.");
  }

  if (!("version" in data)) {
    throw new Error("The saved world is missing a version field.");
  }

  if (data.version === 1) {
    return migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(validateLegacyWorldV1(data))));
  }

  if (data.version === 2) {
    return migrateV3ToV4(migrateV2ToV3(validateLegacyWorldV2(data)));
  }

  if (data.version === 3) {
    return migrateV3ToV4(validateLegacyWorldV3(data));
  }

  if (data.version !== CURRENT_WORLD_VERSION) {
    throw new Error(`Unsupported world version: ${String(data.version)}`);
  }

  return validateWorldV4(data);
}

export function serializeWorld(world: WorldState): string {
  return JSON.stringify(world, null, 2);
}

export function worldsAreEqual(left: WorldState, right: WorldState): boolean {
  return serializeWorld(left) === serializeWorld(right);
}

import {
  CURRENT_WORLD_VERSION,
  type LegacyWorldStateV1,
  type MapTile,
  type TileChange,
  type WorldAction,
  type WorldState,
} from "../world/worldTypes";
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
    isRecord(value.resolvedValues)
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

  return {
    ...data,
    tiles,
    history,
  };
}

function migrateV1ToV2(data: LegacyWorldStateV1): WorldState {
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
      changes: action.changes.map((change) => ({
        tileId: change.tileId,
        before: change.before ?? null,
        after: normalizeMapTile(change.after),
      })),
    }),
  );

  return normalizeLoadedWorld({
    version: 2,
    id: data.id,
    name: data.name,
    tiles,
    history,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

function validateWorldV2(data: Record<string, unknown>): WorldState {
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
    return migrateV1ToV2(validateLegacyWorldV1(data));
  }

  if (data.version !== CURRENT_WORLD_VERSION) {
    throw new Error(`Unsupported world version: ${String(data.version)}`);
  }

  return validateWorldV2(data);
}

export function serializeWorld(world: WorldState): string {
  return JSON.stringify(world, null, 2);
}

export function worldsAreEqual(left: WorldState, right: WorldState): boolean {
  return serializeWorld(left) === serializeWorld(right);
}

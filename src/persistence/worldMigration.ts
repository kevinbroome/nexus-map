import {
  CURRENT_WORLD_VERSION,
  type MapTile,
  type TileChange,
  type WorldAction,
  type WorldState,
} from "../world/worldTypes";

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
    typeof value.terrain === "string"
  );
}

function isTileChange(value: unknown): value is TileChange {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.tileId === "string" &&
    isMapTile(value.before) &&
    isMapTile(value.after)
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
    value.changes.every(isTileChange)
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

  if (data.version !== CURRENT_WORLD_VERSION) {
    throw new Error(`Unsupported world version: ${String(data.version)}`);
  }

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
    if (!isWorldAction(action)) {
      throw new Error("The saved world contains invalid history data.");
    }
  }

  validateHistorySequence(data.history as WorldAction[]);

  return data as unknown as WorldState;
}

export function serializeWorld(world: WorldState): string {
  return JSON.stringify(world, null, 2);
}

export function worldsAreEqual(left: WorldState, right: WorldState): boolean {
  return serializeWorld(left) === serializeWorld(right);
}

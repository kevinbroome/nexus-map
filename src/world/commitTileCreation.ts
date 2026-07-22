import { createTile } from "./tileCreation";
import { getTileId } from "./coordinates";
import { saveWorld } from "../persistence/worldStorage";
import type { TerrainType, WorldAction, WorldState } from "./worldTypes";
import { cloneTile } from "./tileUtils";
import {
  formatCommitMessage,
  getLatestActionSequence,
  type CommitResult,
} from "./commitWorldAction";

function getNextSequence(world: WorldState): number {
  return getLatestActionSequence(world) + 1;
}

export function commitTileCreation(
  world: WorldState,
  coordinate: { x: number; y: number },
  terrain: TerrainType = "empty",
): CommitResult {
  const updatedWorld = createTile(world, coordinate, terrain);
  const tileId = getTileId(coordinate.x, coordinate.y);
  const after = updatedWorld.tiles[tileId];

  if (!after) {
    throw new Error("The new tile could not be created.");
  }

  const action: WorldAction = {
    id: crypto.randomUUID(),
    sequence: getNextSequence(world),
    cardId: "dev-create-tile",
    cardName: "Create tile",
    targetIds: [tileId],
    appliedAt: new Date().toISOString(),
    changes: [
      {
        tileId,
        before: null,
        after: cloneTile(after),
      },
    ],
    randomSeed: "",
    resolvedValues: {
      coordinate,
      terrain,
    },
    turn: world.turn,
    consequences: [],
    regionChanges: [],
    routeChanges: [],
  };

  const committedWorld: WorldState = {
    ...updatedWorld,
    history: [...world.history, action],
    updatedAt: new Date().toISOString(),
  };

  try {
    saveWorld(committedWorld);
  } catch {
    throw new Error("The action could not be saved. The world was not changed.");
  }

  return {
    world: committedWorld,
    action,
    message: formatCommitMessage(action),
  };
}

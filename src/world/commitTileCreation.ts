import { createTile } from "./tileCreation";
import { getTileId } from "./coordinates";
import { persistCommittedWorld } from "../persistence/persistCommittedWorld";
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

export async function commitTileCreation(
  world: WorldState,
  coordinate: { x: number; y: number },
  terrain: TerrainType = "empty",
): Promise<CommitResult> {
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
    cardInstanceId: "",
    effectiveCardDefinitionSummary: {},
    failureAttempts: [],
    deckMutations: [],
    targetIds: [tileId],
    targetResolution: {
      originIds: [tileId],
      destinationIds: [],
      selectedIds: [tileId],
      expandedTargetIds: [tileId],
      resolvedValues: {
        coordinate,
        terrain,
      },
    },
    propagationRecords: [],
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
    await persistCommittedWorld(committedWorld, {
      failureMessage: "The action could not be saved. The world was not changed.",
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("The action could not be saved. The world was not changed.");
  }

  return {
    world: committedWorld,
    action,
    message: formatCommitMessage(action),
  };
}

import type { TargetDefinition } from "../cards/cardTypes";
import type { SelectionState } from "../selection/selectionTypes";
import {
  getConnectedRegion,
  getExistingTilesWithinGraphSteps,
  matchesTerrain,
} from "../world/neighbours";
import type { WorldState } from "../world/worldTypes";

export type TargetResolution =
  | { ok: true; targetIds: string[] }
  | { ok: false; messages: string[] };

export function resolveCardTargets(
  world: WorldState,
  target: TargetDefinition,
  selectionTileIds: string[],
  selection?: SelectionState,
): TargetResolution {
  switch (target.type) {
    case "single-tile": {
      if (selectionTileIds.length === 0) {
        return { ok: false, messages: ["Select a tile first."] };
      }

      if (selectionTileIds.length > 1) {
        return {
          ok: false,
          messages: ["This card requires exactly one selected tile."],
        };
      }

      const tileId = selectionTileIds[0]!;

      if (!world.tiles[tileId]) {
        return { ok: false, messages: ["Selected tile does not exist."] };
      }

      return { ok: true, targetIds: [tileId] };
    }

    case "adjacent-tiles": {
      if (selectionTileIds.length === 0) {
        return { ok: false, messages: ["Select a tile first."] };
      }

      if (selectionTileIds.length > 1) {
        return {
          ok: false,
          messages: ["This card requires exactly one anchor tile."],
        };
      }

      const anchorId = selectionTileIds[0]!;
      const anchor = world.tiles[anchorId];

      if (!anchor) {
        return { ok: false, messages: ["Selected tile does not exist."] };
      }

      const targetTiles = getExistingTilesWithinGraphSteps(
        world,
        anchorId,
        target.radius,
        "cardinal",
      );

      return {
        ok: true,
        targetIds: targetTiles.map((tile) => tile.id),
      };
    }

    case "connected-region": {
      if (selectionTileIds.length === 0) {
        return { ok: false, messages: ["Select a tile first."] };
      }

      if (selectionTileIds.length > 1) {
        return {
          ok: false,
          messages: ["This card requires exactly one anchor tile."],
        };
      }

      const anchorId = selectionTileIds[0]!;
      const anchor = world.tiles[anchorId];

      if (!anchor) {
        return { ok: false, messages: ["Selected tile does not exist."] };
      }

      const terrain = target.terrain ?? anchor.terrain;
      const region = getConnectedRegion(
        world,
        anchorId,
        matchesTerrain(terrain),
        "cardinal",
      );

      if (region.length === 0) {
        return {
          ok: false,
          messages: [
            `No connected ${terrain} region starts at the selected tile.`,
          ],
        };
      }

      return {
        ok: true,
        targetIds: region.map((tile) => tile.id),
      };
    }

    case "two-endpoints": {
      const originId = selection?.routeOriginTileId;
      const destinationId = selection?.routeDestinationTileId;

      if (!originId) {
        return { ok: false, messages: ["Select a route origin."] };
      }

      if (!destinationId) {
        return { ok: false, messages: ["Select a route destination."] };
      }

      if (!world.tiles[originId]) {
        return { ok: false, messages: ["Route origin tile does not exist."] };
      }

      if (!world.tiles[destinationId]) {
        return {
          ok: false,
          messages: ["Route destination tile does not exist."],
        };
      }

      if (originId === destinationId) {
        return {
          ok: false,
          messages: ["Route origin and destination must differ."],
        };
      }

      return { ok: true, targetIds: [originId, destinationId] };
    }

    case "rectangle":
    case "settlement":
    case "global":
      return {
        ok: false,
        messages: [`Target type "${target.type}" is not implemented yet.`],
      };

    default: {
      const unreachable: never = target;
      return {
        ok: false,
        messages: [`Unsupported target type: ${String(unreachable)}`],
      };
    }
  }
}

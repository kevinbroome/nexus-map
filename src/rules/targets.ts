import { createTileId } from "../world/worldState";
import type { MapTile, WorldState } from "../world/worldTypes";
import type { TargetDefinition } from "../cards/cardTypes";

export type TargetResolution =
  | { ok: true; targetIds: string[] }
  | { ok: false; messages: string[] };

function getTileNeighbours(
  world: WorldState,
  tile: MapTile,
): MapTile[] {
  const neighbours: MapTile[] = [];
  const offsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  for (const [offsetX, offsetY] of offsets) {
    const neighbour = world.tiles[createTileId(tile.x + offsetX, tile.y + offsetY)];

    if (neighbour) {
      neighbours.push(neighbour);
    }
  }

  return neighbours;
}

function collectTilesWithinRadius(
  world: WorldState,
  anchor: MapTile,
  radius: number,
): string[] {
  const tileIds = new Set<string>();
  tileIds.add(anchor.id);

  let frontier = [anchor];

  for (let step = 0; step < radius; step++) {
    const nextFrontier: MapTile[] = [];

    for (const tile of frontier) {
      for (const neighbour of getTileNeighbours(world, tile)) {
        if (tileIds.has(neighbour.id)) {
          continue;
        }

        tileIds.add(neighbour.id);
        nextFrontier.push(neighbour);
      }
    }

    frontier = nextFrontier;
  }

  return [...tileIds];
}

export function resolveCardTargets(
  world: WorldState,
  target: TargetDefinition,
  selectionTileIds: string[],
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

      return {
        ok: true,
        targetIds: collectTilesWithinRadius(world, anchor, target.radius),
      };
    }

    case "connected-region":
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

export function getOrthogonalNeighbourIds(
  world: WorldState,
  tile: MapTile,
): string[] {
  return getTileNeighbours(world, tile).map((neighbour) => neighbour.id);
}

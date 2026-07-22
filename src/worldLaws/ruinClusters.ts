import {
  getExistingNeighbours,
  type ConnectionMode,
} from "../world/neighbours";
import type { MapTile, WorldState } from "../world/worldTypes";
import { isRuinSettlement } from "../world/worldTypes";

function compareTiles(left: MapTile, right: MapTile): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

export function findRuinClusters(
  world: WorldState,
  mode: ConnectionMode = "cardinal",
): MapTile[][] {
  const ruinTiles = Object.values(world.tiles)
    .filter((tile) => isRuinSettlement(tile.settlement))
    .sort(compareTiles);

  const visited = new Set<string>();
  const clusters: MapTile[][] = [];

  for (const tile of ruinTiles) {
    if (visited.has(tile.id)) {
      continue;
    }

    const cluster: MapTile[] = [];
    const queue = [tile];
    visited.add(tile.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const neighbour of getExistingNeighbours(world, current.id, mode)) {
        if (visited.has(neighbour.id) || !isRuinSettlement(neighbour.settlement)) {
          continue;
        }

        visited.add(neighbour.id);
        queue.push(neighbour);
      }
    }

    cluster.sort(compareTiles);
    clusters.push(cluster);
  }

  clusters.sort((left, right) => left[0]!.id.localeCompare(right[0]!.id));

  return clusters;
}

export function findRuinClusterForTile(
  world: WorldState,
  tileId: string,
  mode: ConnectionMode = "cardinal",
): MapTile[] {
  const tile = world.tiles[tileId];

  if (!tile || !isRuinSettlement(tile.settlement)) {
    return [];
  }

  for (const cluster of findRuinClusters(world, mode)) {
    if (cluster.some((clusterTile) => clusterTile.id === tileId)) {
      return cluster;
    }
  }

  return [];
}

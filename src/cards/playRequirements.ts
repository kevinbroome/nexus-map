import {
  countProductiveTerrainTiles,
  countTerrainTiles,
  getWorldTileCount,
  hasTerrain,
} from "../world/worldQueries";
import type { TerrainType, WorldState } from "../world/worldTypes";

export type PlayRequirementDefinition =
  | { type: "minimum-terrain-count"; terrains: TerrainType[]; count: number }
  | { type: "minimum-water-tiles"; count: number }
  | { type: "minimum-productive-terrain"; count: number }
  | { type: "minimum-tile-count"; count: number }
  | { type: "requires-terrain-present"; terrain: TerrainType };

export function evaluatePlayRequirements(
  world: WorldState,
  requirements: PlayRequirementDefinition[] | undefined,
): { playable: boolean; messages: string[] } {
  if (!requirements || requirements.length === 0) {
    return { playable: true, messages: [] };
  }

  const messages: string[] = [];

  for (const requirement of requirements) {
    switch (requirement.type) {
      case "minimum-terrain-count": {
        const count = countTerrainTiles(world, requirement.terrains);
        if (count < requirement.count) {
          messages.push(
            `Requires at least ${requirement.count} ${requirement.terrains.join("/")} tiles (found ${count}).`,
          );
        }
        break;
      }
      case "minimum-water-tiles": {
        const count = countTerrainTiles(world, "water");
        if (count < requirement.count) {
          messages.push(
            `Requires at least ${requirement.count} water tiles (found ${count}).`,
          );
        }
        break;
      }
      case "minimum-productive-terrain": {
        const count = countProductiveTerrainTiles(world);
        if (count < requirement.count) {
          messages.push(
            `Requires at least ${requirement.count} grassland or forest tiles (found ${count}).`,
          );
        }
        break;
      }
      case "minimum-tile-count": {
        const count = getWorldTileCount(world);
        if (count < requirement.count) {
          messages.push(
            `Requires at least ${requirement.count} map tiles (found ${count}).`,
          );
        }
        break;
      }
      case "requires-terrain-present": {
        if (!hasTerrain(world, requirement.terrain)) {
          messages.push(`Requires at least one ${requirement.terrain} tile on the map.`);
        }
        break;
      }
      default: {
        const unreachable: never = requirement;
        throw new Error(`Unsupported play requirement: ${String(unreachable)}`);
      }
    }
  }

  return {
    playable: messages.length === 0,
    messages,
  };
}

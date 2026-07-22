import type {
  MapTile,
  TileChange,
  WorldConsequence,
  WorldState,
} from "../world/worldTypes";
import { isVillageSettlement } from "../world/worldTypes";
import { cloneTile } from "../world/tileUtils";
import { INHOSPITABLE_TERRAINS, VILLAGE_RUIN_THRESHOLD } from "./constants";

export type VillageDeclineResult = {
  tiles: Record<string, MapTile>;
  tileChanges: TileChange[];
  consequences: WorldConsequence[];
};

function isInhospitableTerrain(terrain: MapTile["terrain"]): boolean {
  return INHOSPITABLE_TERRAINS.has(terrain);
}

export function applyVillageDecline(
  world: WorldState,
  nextTurn: number,
): VillageDeclineResult {
  const tiles = { ...world.tiles };
  const tileChanges: TileChange[] = [];
  const consequences: WorldConsequence[] = [];

  const villageTiles = Object.values(world.tiles)
    .filter((tile) => isVillageSettlement(tile.settlement))
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const before of villageTiles) {
    const settlement = before.settlement;

    if (!isVillageSettlement(settlement)) {
      continue;
    }

    const previousTurns = settlement.inhospitableTurns;
    let currentTurns = previousTurns;

    if (isInhospitableTerrain(before.terrain)) {
      currentTurns += 1;
    } else {
      currentTurns = 0;
    }

    let after = cloneTile(before);

    if (currentTurns >= VILLAGE_RUIN_THRESHOLD) {
      after = cloneTile(before);
      after.settlement = {
        type: "ruin",
        formerType: "village",
        ruinedAtTurn: nextTurn,
      };

      if (!after.tags.includes("ruined")) {
        after.tags = [...after.tags, "ruined"];
      }

      consequences.push({
        type: "village-became-ruin",
        tileId: before.id,
        turn: nextTurn,
      });
    } else if (currentTurns !== previousTurns) {
      after = cloneTile(before);
      after.settlement = {
        ...settlement,
        inhospitableTurns: currentTurns,
      };

      consequences.push({
        type: "village-decline-advanced",
        tileId: before.id,
        previousTurns,
        currentTurns,
      });
    } else {
      continue;
    }

    tiles[before.id] = after;
    tileChanges.push({
      tileId: before.id,
      before: cloneTile(before),
      after: cloneTile(after),
    });
  }

  return { tiles, tileChanges, consequences };
}

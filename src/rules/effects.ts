import type { EffectDefinition } from "../cards/cardTypes";

import type { MapTile } from "../world/worldTypes";

import {

  cloneTile,

  createVillageSettlement,

  tilesAreEqual,

} from "../world/tileUtils";

import { isRuinSettlement, isVillageSettlement } from "../world/worldTypes";

import type { WorldState } from "../world/worldTypes";

import { getExistingNeighbourIds } from "../world/neighbours";

import { createSeededRandom, pickRandomItems } from "./random";

import { VILLAGE_RUIN_THRESHOLD } from "../worldLaws/constants";



export type EffectContext = {

  world: WorldState;

  random: () => number;

  resolvedValues: Record<string, unknown>;

  effectKey: string;

};



export function applyEffectToTile(

  tile: MapTile,

  effect: EffectDefinition,

  context: EffectContext,

): MapTile {

  const updatedTile = cloneTile(tile);



  switch (effect.type) {

    case "set-terrain":

      updatedTile.terrain = effect.terrain;



      if (effect.terrain === "water") {

        delete updatedTile.settlement;

      }



      return updatedTile;



    case "add-settlement":

      updatedTile.settlement = createVillageSettlement();

      return updatedTile;



    case "upgrade-settlement":

      if (!updatedTile.settlement) {

        throw new Error(`Tile "${tile.id}" has no settlement to upgrade.`);

      }



      return updatedTile;



    case "remove-settlement":

      delete updatedTile.settlement;

      return updatedTile;



    case "add-tag":

      if (!updatedTile.tags.includes(effect.tag)) {

        updatedTile.tags = [...updatedTile.tags, effect.tag];

      }

      return updatedTile;

    case "remove-tag":
      updatedTile.tags = updatedTile.tags.filter((entry) => entry !== effect.tag);
      return updatedTile;

    case "set-random-terrain": {
      const index = Math.floor(context.random() * effect.terrains.length);
      updatedTile.terrain = effect.terrains[index] ?? effect.terrains[0]!;

      if (updatedTile.terrain === "water") {
        delete updatedTile.settlement;
      }

      context.resolvedValues[`${context.effectKey}.terrain`] = updatedTile.terrain;
      return updatedTile;
    }

    case "advance-village-decline": {
      const settlement = updatedTile.settlement;

      if (!isVillageSettlement(settlement)) {
        return updatedTile;
      }

      const amount = effect.amount ?? 1;
      updatedTile.settlement = {
        ...settlement,
        inhospitableTurns: Math.min(
          VILLAGE_RUIN_THRESHOLD,
          settlement.inhospitableTurns + amount,
        ),
      };

      return updatedTile;
    }

    case "restore-village-from-ruin": {
      if (!isRuinSettlement(updatedTile.settlement)) {
        return updatedTile;
      }

      updatedTile.settlement = createVillageSettlement();
      updatedTile.tags = updatedTile.tags.filter((entry) => entry !== "ruined");
      return updatedTile;
    }

    case "empty-urban-region":
    case "create-travel-route":
      return updatedTile;

    case "change-neighbouring-terrain": {
      const neighbourIds = getExistingNeighbourIds(
        context.world,
        tile,
        "cardinal",
      ).filter((neighbourId) => {
        const neighbour = context.world.tiles[neighbourId];
        return neighbour && neighbour.terrain !== effect.terrain;
      });

      const pickedIds = pickRandomItems(
        neighbourIds,
        effect.count,
        context.random,
      );

      const resolvedKey = `${context.effectKey}.neighbours`;
      context.resolvedValues[resolvedKey] = pickedIds;

      for (const neighbourId of pickedIds) {
        const neighbour = context.world.tiles[neighbourId];

        if (!neighbour) {
          continue;
        }

        context.world.tiles[neighbourId] = applyEffectToTile(
          neighbour,
          { type: "set-terrain", terrain: effect.terrain },
          context,
        );
      }

      return updatedTile;
    }

    case "propagate":
      return updatedTile;

    default: {

      const unreachable: never = effect;

      throw new Error(`Unsupported effect: ${String(unreachable)}`);

    }

  }

}



export function applyEffectsToTile(

  world: WorldState,

  tile: MapTile,

  effects: EffectDefinition[],

  randomSeed: string,

  resolvedValues: Record<string, unknown>,

): Record<string, MapTile> {

  const workingTiles = Object.fromEntries(

    Object.entries(world.tiles).map(([tileId, currentTile]) => [

      tileId,

      cloneTile(currentTile),

    ]),

  );

  const workingWorld: WorldState = { ...world, tiles: workingTiles };

  const random = createSeededRandom(`${randomSeed}:${tile.id}`);

  let currentTile = cloneTile(tile);

  workingWorld.tiles[tile.id] = currentTile;



  effects.forEach((effect, index) => {

    currentTile = applyEffectToTile(currentTile, effect, {

      world: workingWorld,

      random,

      resolvedValues,

      effectKey: `${tile.id}.${index}`,

    });



    workingWorld.tiles[tile.id] = currentTile;

  });



  const modifiedTiles: Record<string, MapTile> = {};



  for (const [tileId, afterTile] of Object.entries(workingWorld.tiles)) {

    const beforeTile = world.tiles[tileId];



    if (beforeTile && !tilesAreEqual(beforeTile, afterTile)) {

      modifiedTiles[tileId] = afterTile;

    }

  }



  return modifiedTiles;

}

export function applyEmptyUrbanRegionEffect(
  world: WorldState,
  anchorTileId: string,
  effect: Extract<EffectDefinition, { type: "empty-urban-region" }>,
  randomSeed: string,
  resolvedValues: Record<string, unknown>,
): Record<string, MapTile> {
  const anchor = world.tiles[anchorTileId];

  if (!anchor || anchor.terrain !== "urban") {
    return {};
  }

  const regionIds = getConnectedUrbanTileIds(world, anchorTileId);
  const random = createSeededRandom(`${randomSeed}:empty-urban`);
  const picked = pickRandomItems(
    regionIds.filter((id) => id !== anchorTileId || regionIds.length === 1),
    Math.min(effect.tileLimit, regionIds.length),
    random,
  );

  resolvedValues.emptyUrbanTiles = picked;
  const modified: Record<string, MapTile> = {};

  for (const tileId of picked) {
    const before = world.tiles[tileId];

    if (!before) {
      continue;
    }

    let after = cloneTile(before);
    after.terrain = "empty";

    if (effect.leaveRuins && after.settlement && isVillageSettlement(after.settlement)) {
      after.settlement = {
        type: "ruin",
        formerType: "village",
        ruinedAtTurn: world.turn + 1,
      };

      if (!after.tags.includes("ruined")) {
        after.tags = [...after.tags, "ruined"];
      }
    } else if (after.settlement) {
      delete after.settlement;
    }

    modified[tileId] = after;
  }

  return modified;
}

function getConnectedUrbanTileIds(world: WorldState, startTileId: string): string[] {
  const visited = new Set<string>();
  const queue = [startTileId];

  while (queue.length > 0) {
    const tileId = queue.shift()!;

    if (visited.has(tileId)) {
      continue;
    }

    const tile = world.tiles[tileId];

    if (!tile || tile.terrain !== "urban") {
      continue;
    }

    visited.add(tileId);

    for (const neighbour of getExistingNeighbourIds(
      world,
      world.tiles[tileId]!,
      "cardinal",
    )) {
      if (!visited.has(neighbour)) {
        queue.push(neighbour);
      }
    }
  }

  return [...visited].sort();
}


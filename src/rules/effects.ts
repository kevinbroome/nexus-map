import type { EffectDefinition } from "../cards/cardTypes";

import type { MapTile } from "../world/worldTypes";

import {

  cloneTile,

  createVillageSettlement,

  tilesAreEqual,

} from "../world/tileUtils";

import type { WorldState } from "../world/worldTypes";

import { getExistingNeighbourIds } from "../world/neighbours";

import { createSeededRandom, pickRandomItems } from "./random";



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

    case "create-travel-route":
      return updatedTile;

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


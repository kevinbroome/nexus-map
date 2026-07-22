import type { TerrainType } from "../../world/worldTypes";

export const MAX_PROPAGATION_STEPS = 10_000;
export const MAX_CREATED_TILES_PER_ACTION = 1_000;

export const DEFAULT_TERRAIN_PRIORITIES: Record<TerrainType, number> = {
  empty: 0,
  grassland: 1,
  desert: 1,
  forest: 2,
  urban: 3,
  mountain: 4,
  water: 5,
  chasm: 10,
};

/** 0 = no resistance; Infinity = complete barrier. */
export const RESISTANCE_MINOR = 2;
export const RESISTANCE_SIGNIFICANT = 6;
export const RESISTANCE_MAJOR = 12;

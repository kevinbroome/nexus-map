/** Shared balance defaults for the advanced test deck. Cards may override locally. */

export const DEFAULT_PROPAGATION_MAGNITUDE = {
  small: { minimum: 2, maximum: 4 },
  medium: { minimum: 3, maximum: 6 },
  large: { minimum: 4, maximum: 8 },
} as const;

export const TERRAIN_RESISTANCE_DEFAULTS = {
  urban: 5,
  mountain: Number.POSITIVE_INFINITY,
  road: 3,
  village: 5,
} as const;

export const VILLAGE_DECLINE_THRESHOLD = 3;

export const ROAD_ATTRACTION_MULTIPLIER = 0.5;

export const MAX_MAP_EXPANSION_PER_CARD = 5;

export const MAX_DECK_MUTATION_COPIES = 1;

export const SETTLEMENT_GROWTH_THRESHOLDS = {
  town: 3,
  expanse: 5,
  urbanRegion: 7,
  quadrant: 10,
  sunder: 12,
} as const;

export const LONG_ROAD_MAX_DISTANCE = 12;

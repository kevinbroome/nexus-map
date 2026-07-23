import type { PropagatingEffectDefinition } from "../rules/propagation/types";
import { singlePrimaryTileTarget } from "./cardTargets";

export const creepingWildsIIEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "forest" },
  strategy: { type: "breadth-first", neighbourMode: "cardinal" },
  magnitude: { type: "fixed", value: 6 },
  traversal: {
    preferMatchingTerrain: true,
    matchingTerrainMultiplier: 0.5,
  },
  resistance: [
    { type: "terrain", terrain: "urban", resistance: 5 },
    { type: "terrain", terrain: "mountain", resistance: Number.POSITIVE_INFINITY },
  ],
  replacement: {
    type: "only",
    terrains: ["empty", "grassland", "desert"],
  },
  boundary: { type: "discard-overflow" },
});

export const theFloodComesEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "water" },
  strategy: { type: "weighted-frontier", neighbourMode: "cardinal" },
  magnitude: { type: "random-range", minimum: 4, maximum: 8 },
  traversal: {
    terrainCosts: {
      grassland: 1,
      desert: 1,
      forest: 3,
      urban: 4,
      mountain: Number.POSITIVE_INFINITY,
    },
  },
  replacement: {
    type: "matrix",
    default: "deny",
    rules: [
      { from: "empty", to: "water", allowed: true },
      { from: "grassland", to: "water", allowed: true },
      { from: "desert", to: "water", allowed: true },
      { from: "forest", to: "water", allowed: true },
      { from: "urban", to: "water", allowed: true },
      { from: "mountain", to: "water", allowed: false },
      { from: "chasm", to: "water", allowed: false },
    ],
  },
  boundary: {
    type: "create-operation-terrain",
    maximumNewTiles: { type: "fixed", value: 3 },
  },
});

export const marchOfTheChasmEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "chasm" },
  strategy: {
    type: "directional",
    direction: { type: "random-cardinal" },
    spread: 1,
  },
  magnitude: { type: "fixed", value: 5 },
  resistance: [
    { type: "route", routeType: "road", resistance: 3 },
    { type: "settlement-tier", tier: "village", resistance: 5 },
  ],
  replacement: {
    type: "priority",
    incomingPriority: 10,
    terrainPriorities: {},
    allowEqual: false,
  },
  boundary: {
    type: "create-operation-terrain",
    maximumNewTiles: { type: "fixed", value: 2 },
  },
});

export const theOldRoadHoldsEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "add-tag", tag: "protected" },
  strategy: { type: "follow-network", routeType: "road" },
  magnitude: { type: "fixed", value: 6 },
  boundary: { type: "stop" },
});

export const ashWalkEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "add-tag", tag: "ash" },
  strategy: {
    type: "random-walk",
    neighbourMode: "cardinal",
    allowRevisit: false,
  },
  magnitude: { type: "fixed", value: 7 },
  stoppingConditions: [
    { type: "terrain", terrains: ["water", "chasm"] },
  ],
  boundary: { type: "stop" },
});

export const creepingWildsIITarget = () => singlePrimaryTileTarget();

export const theFloodComesTarget = () => singlePrimaryTileTarget();

export const marchOfTheChasmTarget = () => singlePrimaryTileTarget();

export const theOldRoadHoldsTarget = () => singlePrimaryTileTarget();

export const ashWalkTarget = () => singlePrimaryTileTarget();

export const creepingWildsDeckEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "forest" },
  strategy: { type: "breadth-first", neighbourMode: "cardinal" },
  magnitude: { type: "random-range", minimum: 4, maximum: 7 },
  traversal: {
    preferMatchingTerrain: true,
    matchingTerrainMultiplier: 0.5,
  },
  resistance: [
    { type: "terrain", terrain: "urban", resistance: 5 },
    { type: "terrain", terrain: "mountain", resistance: Number.POSITIVE_INFINITY },
  ],
  replacement: {
    type: "only",
    terrains: ["empty", "grassland", "desert"],
  },
  boundary: { type: "discard-overflow" },
});

export const stoneRisingEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "mountain" },
  strategy: {
    type: "directional",
    direction: { type: "random-cardinal" },
    spread: 1,
  },
  magnitude: { type: "random-range", minimum: 3, maximum: 5 },
  replacement: {
    type: "exclude",
    terrains: ["chasm"],
  },
  boundary: { type: "stop" },
});

export const watersRecedeEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "grassland" },
  strategy: { type: "random-frontier", neighbourMode: "cardinal" },
  magnitude: { type: "random-range", minimum: 2, maximum: 4 },
  replacement: {
    type: "only",
    terrains: ["water"],
  },
  boundary: { type: "stop" },
});

export const desertWindEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "desert" },
  strategy: {
    type: "directional",
    direction: { type: "random-cardinal" },
    spread: 1,
  },
  magnitude: { type: "random-range", minimum: 3, maximum: 6 },
  replacement: {
    type: "exclude",
    terrains: ["water", "chasm", "mountain"],
  },
  boundary: { type: "discard-overflow" },
});

export const landBreaksEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "chasm" },
  strategy: {
    type: "directional",
    direction: { type: "random-cardinal" },
    spread: 1,
  },
  magnitude: { type: "fixed", value: 3 },
  replacement: {
    type: "exclude",
    terrains: ["chasm"],
  },
  boundary: { type: "stop" },
});

export const urbanPressureEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "urban" },
  strategy: { type: "breadth-first", neighbourMode: "cardinal" },
  magnitude: {
    type: "settlement-tier-value",
    values: {
      town: 3,
      expanse: 4,
      "urban-region": 5,
      quadrant: 6,
      sunder: 6,
    },
    fallback: 3,
  },
  replacement: {
    type: "only",
    terrains: ["empty", "grassland", "forest", "desert"],
  },
  boundary: { type: "discard-overflow" },
});

export const edgeExpansionEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "empty" },
  strategy: { type: "random-frontier", neighbourMode: "cardinal" },
  magnitude: { type: "fixed", value: 1 },
  replacement: { type: "allow-all" },
  boundary: {
    type: "create-blank-tiles",
    terrain: "empty",
    maximumNewTiles: { type: "fixed", value: 1 },
  },
});

export const newCountryEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "grassland" },
  strategy: { type: "random-frontier", neighbourMode: "cardinal" },
  magnitude: { type: "random-range", minimum: 3, maximum: 5 },
  replacement: {
    type: "only",
    terrains: ["empty", "grassland"],
  },
  boundary: {
    type: "create-blank-tiles",
    terrain: "empty",
    maximumNewTiles: { type: "fixed", value: 5 },
  },
});

export const echoWildSpreadEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "forest" },
  strategy: { type: "breadth-first", neighbourMode: "cardinal" },
  magnitude: { type: "fixed", value: 3 },
  traversal: {
    preferMatchingTerrain: true,
    matchingTerrainMultiplier: 0.5,
  },
  replacement: {
    type: "only",
    terrains: ["empty", "grassland", "forest"],
  },
  boundary: { type: "discard-overflow" },
});

export const chasmMarchesEffect = (): PropagatingEffectDefinition => ({
  type: "propagate",
  operation: { type: "set-terrain", terrain: "chasm" },
  strategy: {
    type: "directional",
    direction: { type: "random-cardinal" },
    spread: 1,
  },
  magnitude: { type: "random-range", minimum: 3, maximum: 5 },
  resistance: [
    { type: "route", routeType: "road", resistance: 3 },
    { type: "settlement-tier", tier: "village", resistance: 5 },
  ],
  replacement: {
    type: "priority",
    incomingPriority: 10,
    terrainPriorities: {},
    allowEqual: false,
  },
  boundary: {
    type: "create-operation-terrain",
    maximumNewTiles: { type: "fixed", value: 2 },
  },
});

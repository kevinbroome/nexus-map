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

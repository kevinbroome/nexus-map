import type { TargetDefinition } from "../rules/targeting/types";
import type { TerrainType } from "../world/worldTypes";
import type { TravelNodeType } from "../networks/networkTypes";

export const singlePrimaryTileTarget = (): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: { type: "origin-only" },
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const adjacentPrimaryTarget = (radius: number): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: {
    type: "within-distance",
    distance: { type: "fixed", value: radius },
    metric: "manhattan",
    includeOrigin: true,
  },
  selection: { type: "all" },
  expansion: { type: "none" },
});

export const connectedRegionTarget = (
  terrain: TerrainType,
): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: {
    type: "connected-region",
    connection: "cardinal",
    match: { type: "terrain", terrain },
  },
  selection: { type: "all" },
  expansion: { type: "none" },
});

export const twoEndpointRouteTarget = (
  allowedNodeTypes: TravelNodeType[],
): TargetDefinition => ({
  origin: { type: "primary-selection" },
  destination: { type: "secondary-selection" },
  search: { type: "origin-only" },
  selection: { type: "first" },
  expansion: { type: "none" },
  requirements: [{ type: "minimum-target-count", count: 1 }],
  // allowedNodeTypes validated at route endpoint inference time
  ...(allowedNodeTypes.length > 0 ? {} : {}),
});

export const exactDistanceTarget = (distance: number): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: {
    type: "exact-distance",
    distance: { type: "fixed", value: distance },
    metric: "manhattan",
  },
  filters: [{ type: "tile-exists" }],
  selection: { type: "random-one" },
  expansion: { type: "none" },
});

export const distantFoundationsTarget = (): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: {
    type: "exact-distance",
    distance: { type: "fixed", value: 3 },
    metric: "manhattan",
  },
  filters: [
    { type: "tile-exists" },
    { type: "terrain-is-not", terrain: "water" },
    { type: "terrain-is-not", terrain: "chasm" },
    { type: "has-no-settlement" },
  ],
  selection: { type: "random-one" },
  expansion: { type: "none" },
});

export const edgeOfTheKnownTarget = (): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: { type: "map-boundary" },
  ordering: { type: "nearest-to-origin" },
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const marchOfStoneTarget = (): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: { type: "origin-only" },
  selection: { type: "first" },
  expansion: {
    type: "line",
    direction: { type: "random-cardinal" },
    length: { type: "fixed", value: 4 },
    includeOrigin: true,
  },
  requirements: [{ type: "all-targets-must-exist" }],
});

export const nearestRoadTarget = (): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: { type: "nearest" },
  filters: [{ type: "has-settlement" }, { type: "is-not-connected-to-road" }],
  ordering: { type: "nearest-to-origin" },
  selection: { type: "nearest-one" },
  expansion: { type: "none" },
});

export const ringOfAshTarget = (): TargetDefinition => ({
  origin: { type: "primary-selection" },
  search: { type: "origin-only" },
  selection: { type: "first" },
  expansion: {
    type: "ring",
    radius: { type: "fixed", value: 2 },
    metric: "manhattan",
  },
  requirements: [{ type: "all-targets-must-exist" }],
});

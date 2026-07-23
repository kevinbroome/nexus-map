import type { TargetDefinition, TargetFilterDefinition } from "../rules/targeting/types";
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

export const autoCentreTileTarget = (
  filters: TargetFilterDefinition[] = [],
): TargetDefinition => ({
  origin: { type: "world-centre" },
  search: { type: "origin-only" },
  filters,
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomWildTerrainOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "terrain-in", terrains: ["forest", "grassland"] }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomWaterOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "terrain-is", terrain: "water" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomChasmOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "terrain-is", terrain: "chasm" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomBoundaryOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-boundary-tile" },
  search: { type: "origin-only" },
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomVillageOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "settlement-tier-is", tier: "village" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const settlementSpreadTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "adjacent", mode: "cardinal" },
  filters: [
    { type: "terrain-is-not", terrain: "water" },
    { type: "terrain-is-not", terrain: "chasm" },
    { type: "has-no-settlement" },
  ],
  ordering: { type: "nearest-to-origin" },
  selection: { type: "nearest-one" },
  expansion: { type: "none" },
  requirements: [{ type: "minimum-target-count", count: 1 }],
});

export const roadBetweenTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  destination: { type: "nearest-settlement", settlementTier: "village" },
  search: { type: "origin-only" },
  filters: [{ type: "settlement-tier-is", tier: "village" }],
  selection: { type: "first" },
  expansion: { type: "none" },
  requirements: [{ type: "minimum-target-count", count: 1 }],
});

export const longRoadTarget = (): TargetDefinition => ({
  origin: { type: "nearest-settlement" },
  search: {
    type: "within-distance",
    distance: { type: "fixed", value: 12 },
    metric: "manhattan",
    includeOrigin: false,
  },
  filters: [{ type: "has-settlement" }],
  ordering: { type: "farthest-from-origin" },
  selection: { type: "farthest-one" },
  expansion: { type: "none" },
  requirements: [{ type: "minimum-target-count", count: 1 }],
});

export const crossroadsTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "nearest" },
  filters: [{ type: "is-connected-to-road" }],
  ordering: { type: "nearest-to-origin" },
  selection: { type: "first" },
  expansion: { type: "none" },
  destination: { type: "nearest-settlement" },
  requirements: [{ type: "minimum-target-count", count: 1 }],
});

export const ruinTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "settlement-tier-is", tier: "ruin" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const urbanRegionTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: {
    type: "connected-region",
    connection: "cardinal",
    match: { type: "terrain", terrain: "urban" },
  },
  filters: [{ type: "terrain-is", terrain: "urban" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const roadNetworkOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "is-connected-to-road" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomNonWaterOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "terrain-is-not", terrain: "water" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const desertWindOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "terrain-in", terrains: ["empty", "grassland", "desert"] }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const landBreaksOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "terrain-is-not", terrain: "chasm" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const firstFoundationsTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [
    { type: "terrain-is-not", terrain: "water" },
    { type: "terrain-is-not", terrain: "chasm" },
    { type: "has-no-settlement" },
  ],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const randomSettlementRegionOriginTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [
    {
      type: "settlement-region-tier-in",
      tiers: ["town", "expanse", "urban-region", "quadrant", "sunder"],
    },
  ],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const settlementAbandonedTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [
    { type: "settlement-tier-is", tier: "village" },
    { type: "terrain-in", terrains: ["empty", "desert"] },
  ],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const greenThroughStoneTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [
    { type: "terrain-in", terrains: ["empty", "desert"] },
    { type: "adjacent-to-terrain", terrain: "forest" },
  ],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const roadBlockedTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "is-connected-to-road" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const theLawChangesTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "tile-exists" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

export const forgottenInstructionTarget = (): TargetDefinition => ({
  origin: { type: "random-existing-tile" },
  search: { type: "origin-only" },
  filters: [{ type: "tile-exists" }],
  selection: { type: "first" },
  expansion: { type: "none" },
});

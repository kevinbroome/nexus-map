import type { TerrainType } from "../world/worldTypes";

export type TravelRouteType =
  | "road"
  | "railway"
  | "canal"
  | "trail";

export type TravelNodeType = "tile" | "village" | "settlement-region";

export interface TravelEndpoint {
  type: TravelNodeType;
  id: string;
  tileId: string;
}

export interface TravelRoute {
  id: string;
  type: TravelRouteType;
  origin: TravelEndpoint;
  destination: TravelEndpoint;
  pathTileIds: string[];
  createdTurn: number;
  createdByCardId: string;
  tags: string[];
  properties: Record<string, string | number | boolean>;
}

export interface RouteChange {
  type: "created" | "removed" | "modified";
  routeId: string;
  before?: TravelRoute;
  after?: TravelRoute;
}

export interface ProposedTravelRoute {
  route: TravelRoute;
  pathTileIds: string[];
  totalCost: number;
  validationMessages: string[];
}

export function endpointKey(endpoint: TravelEndpoint): string {
  return `${endpoint.type}:${endpoint.id}`;
}

export function canonicalizeEndpoints(
  origin: TravelEndpoint,
  destination: TravelEndpoint,
): [TravelEndpoint, TravelEndpoint] {
  const originKey = endpointKey(origin);
  const destinationKey = endpointKey(destination);

  if (originKey.localeCompare(destinationKey) <= 0) {
    return [origin, destination];
  }

  return [destination, origin];
}

export type RouteStyleConfig = {
  committedColor: string;
  committedWeight: number;
  committedOpacity: number;
  previewColor: string;
  previewWeight: number;
  previewOpacity: number;
  previewDashArray: string;
};

export const ROUTE_STYLES: Record<TravelRouteType, RouteStyleConfig> = {
  road: {
    committedColor: "#92400e",
    committedWeight: 4,
    committedOpacity: 0.9,
    previewColor: "#d97706",
    previewWeight: 4,
    previewOpacity: 0.75,
    previewDashArray: "8 6",
  },
  railway: {
    committedColor: "#374151",
    committedWeight: 3,
    committedOpacity: 0.85,
    previewColor: "#6b7280",
    previewWeight: 3,
    previewOpacity: 0.7,
    previewDashArray: "4 4",
  },
  canal: {
    committedColor: "#0369a1",
    committedWeight: 3,
    committedOpacity: 0.85,
    previewColor: "#0284c7",
    previewWeight: 3,
    previewOpacity: 0.7,
    previewDashArray: "6 4",
  },
  trail: {
    committedColor: "#78716c",
    committedWeight: 2,
    committedOpacity: 0.8,
    previewColor: "#a8a29e",
    previewWeight: 2,
    previewOpacity: 0.65,
    previewDashArray: "4 6",
  },
};

export const ROAD_TERRAIN_COSTS: Partial<Record<TerrainType, number>> = {
  empty: 1,
  grassland: 1,
  desert: 2,
  forest: 3,
  urban: 1,
  mountain: 8,
  water: Number.POSITIVE_INFINITY,
  chasm: Number.POSITIVE_INFINITY,
};

export const EXISTING_ROUTE_COST_MULTIPLIER = 0.5;
export const MINIMUM_TRAVERSAL_COST = 0.5;

import type { CardDefinition } from "./cardTypes";
import {
  adjacentPrimaryTarget,
  connectedRegionTarget,
  distantFoundationsTarget,
  edgeOfTheKnownTarget,
  marchOfStoneTarget,
  nearestRoadTarget,
  ringOfAshTarget,
  singlePrimaryTileTarget,
  twoEndpointRouteTarget,
} from "./cardTargets";

export const cards: CardDefinition[] = [
  {
    id: "waters-rise",
    name: "The Waters Rise",
    description: "Turn the selected location into water.",
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "water" }],
  },
  {
    id: "wild-growth",
    name: "The Wild Returns",
    description: "Turn the selected location into forest.",
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "forest" }],
  },
  {
    id: "new-foundations",
    name: "New Foundations",
    description: "Create a village on the selected land tile.",
    target: singlePrimaryTileTarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "has-no-settlement" },
    ],
    effects: [{ type: "add-settlement", settlementType: "village" }],
  },
  {
    id: "creeping-wilds",
    name: "Creeping Wilds",
    description: "Spread forest across the selected tile and its neighbours.",
    target: adjacentPrimaryTarget(1),
    conditions: [{ type: "terrain-is-not", terrain: "water" }],
    effects: [{ type: "set-terrain", terrain: "forest" }],
  },
  {
    id: "wild-consumes-itself",
    name: "The Wild Consumes Itself",
    description:
      "Mark every tile in the connected forest region with the ancient tag.",
    target: connectedRegionTarget("forest"),
    conditions: [{ type: "terrain-is", terrain: "forest" }],
    effects: [{ type: "add-tag", tag: "ancient" }],
  },
  {
    id: "the-road-between",
    name: "The Road Between",
    description:
      "Create a road between two villages or settlement regions using the lowest-cost valid path.",
    target: twoEndpointRouteTarget(["village", "settlement-region"]),
    conditions: [],
    effects: [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        preferExistingNetwork: true,
        allowedNodeTypes: ["village", "settlement-region"],
      },
    ],
  },
  {
    id: "dev-tile-road",
    name: "Dev Tile Road",
    description: "Development card: create a road between two selected tiles.",
    target: twoEndpointRouteTarget(["tile"]),
    conditions: [],
    effects: [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        preferExistingNetwork: true,
        allowedNodeTypes: ["tile"],
      },
    ],
  },
  {
    id: "distant-foundations",
    name: "Distant Foundations",
    description:
      "From the selected tile, place a village on one random valid tile exactly three spaces away.",
    target: distantFoundationsTarget(),
    conditions: [],
    effects: [{ type: "add-settlement", settlementType: "village" }],
  },
  {
    id: "edge-of-the-known",
    name: "Edge of the Known",
    description:
      "Mark the nearest map boundary tile from your selection with the frontier tag.",
    target: edgeOfTheKnownTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "frontier" }],
  },
  {
    id: "march-of-stone",
    name: "March of Stone",
    description:
      "Spread mountain terrain in a straight line in a random cardinal direction.",
    target: marchOfStoneTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "mountain" }],
  },
  {
    id: "the-nearest-road",
    name: "The Nearest Road",
    description:
      "Create a road from the selected settlement to the nearest unconnected settlement.",
    target: nearestRoadTarget(),
    conditions: [],
    effects: [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        preferExistingNetwork: true,
        allowedNodeTypes: ["village", "settlement-region"],
      },
    ],
  },
  {
    id: "ring-of-ash",
    name: "Ring of Ash",
    description: "Surround the selected tile with a ring of ash-tagged tiles.",
    target: ringOfAshTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "ash" }],
  },
];

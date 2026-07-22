import type { CardDefinition } from "./cardTypes";

export const cards: CardDefinition[] = [
  {
    id: "waters-rise",
    name: "The Waters Rise",
    description: "Turn the selected location into water.",
    target: { type: "single-tile" },
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "water" }],
  },
  {
    id: "wild-growth",
    name: "The Wild Returns",
    description: "Turn the selected location into forest.",
    target: { type: "single-tile" },
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "forest" }],
  },
  {
    id: "new-foundations",
    name: "New Foundations",
    description: "Create a village on the selected land tile.",
    target: { type: "single-tile" },
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
    target: { type: "adjacent-tiles", radius: 1 },
    conditions: [{ type: "terrain-is-not", terrain: "water" }],
    effects: [{ type: "set-terrain", terrain: "forest" }],
  },
  {
    id: "wild-consumes-itself",
    name: "The Wild Consumes Itself",
    description:
      "Mark every tile in the connected forest region with the ancient tag.",
    target: { type: "connected-region", terrain: "forest" },
    conditions: [{ type: "terrain-is", terrain: "forest" }],
    effects: [{ type: "add-tag", tag: "ancient" }],
  },
  {
    id: "the-road-between",
    name: "The Road Between",
    description:
      "Create a road between two villages or settlement regions using the lowest-cost valid path.",
    target: {
      type: "two-endpoints",
      allowedNodeTypes: ["village", "settlement-region"],
    },
    conditions: [],
    effects: [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        preferExistingNetwork: true,
      },
    ],
  },
  {
    id: "dev-tile-road",
    name: "Dev Tile Road",
    description: "Development card: create a road between two selected tiles.",
    target: {
      type: "two-endpoints",
      allowedNodeTypes: ["tile"],
    },
    conditions: [],
    effects: [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        preferExistingNetwork: true,
      },
    ],
  },
];

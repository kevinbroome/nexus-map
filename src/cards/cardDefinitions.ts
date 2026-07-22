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
];

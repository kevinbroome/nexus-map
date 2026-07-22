import type { CardDefinition } from "./cardTypes";

export const cards: CardDefinition[] = [
  {
    id: "waters-rise",
    name: "The Waters Rise",
    description: "Turn the selected location into water.",
    targetType: "tile",
    action: {
      type: "set-terrain",
      terrain: "water",
    },
  },
  {
    id: "wild-growth",
    name: "The Wild Returns",
    description: "Turn the selected location into forest.",
    targetType: "tile",
    action: {
      type: "set-terrain",
      terrain: "forest",
    },
  },
  {
    id: "new-foundations",
    name: "New Foundations",
    description: "Create a village on the selected land tile.",
    targetType: "tile",
    action: {
      type: "add-settlement",
      settlementType: "village",
    },
  },
];

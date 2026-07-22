import type { CardDefinition } from "./cardTypes";

export const cards: CardDefinition[] = [
  {
    id: "create-water",
    name: "The Waters Rise",
    description: "Turn the selected tile into water.",
    targetType: "tile",
    action: "set-terrain",
    value: "water",
  },
  {
    id: "create-forest",
    name: "The Wild Returns",
    description: "Turn the selected tile into forest.",
    targetType: "tile",
    action: "set-terrain",
    value: "forest",
  },
  {
    id: "found-village",
    name: "New Foundations",
    description: "Create a village on valid land.",
    targetType: "tile",
    action: "add-settlement",
    value: "village",
  },
];

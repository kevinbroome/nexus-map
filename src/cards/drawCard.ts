import { cards } from "./cardDefinitions";
import type { CardDefinition } from "./cardTypes";

export function drawRandomCard(): CardDefinition {
  const index = Math.floor(Math.random() * cards.length);
  return cards[index]!;
}

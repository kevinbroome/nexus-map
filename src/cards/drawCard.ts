import { cards } from "./cardDefinitions";
import type { CardDefinition } from "./cardTypes";

function getPlayableCards(): CardDefinition[] {
  return cards.filter((card) => !card.id.startsWith("dev-"));
}

export function drawRandomCard(): CardDefinition {
  const playableCards = getPlayableCards();
  const index = Math.floor(Math.random() * playableCards.length);
  return playableCards[index]!;
}

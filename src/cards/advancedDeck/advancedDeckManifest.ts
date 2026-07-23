import type { CardCategory } from "../cardTypes";

export interface DeckManifestEntry {
  definitionId: string;
  name: string;
  category: CardCategory;
  copies: number;
  summary: string;
}

export const FIRST_ADVANCED_TEST_DECK_MANIFEST: DeckManifestEntry[] = [
  {
    definitionId: "green-beginning",
    name: "Green Beginning",
    category: "creation",
    copies: 2,
    summary: "Forest seed with adjacent grassland near the world centre.",
  },
  {
    definitionId: "spring-from-stone",
    name: "Spring from Stone",
    category: "creation",
    copies: 2,
    summary: "Create water and adjacent grassland on valid land.",
  },
  {
    definitionId: "first-foundations",
    name: "First Foundations",
    category: "creation",
    copies: 3,
    summary: "Place a village on valid land.",
  },
  {
    definitionId: "stone-rising",
    name: "Stone Rising",
    category: "creation",
    copies: 2,
    summary: "Spread mountain in a clustered line.",
  },
  {
    definitionId: "creeping-wilds",
    name: "Creeping Wilds",
    category: "growth",
    copies: 3,
    summary: "Spread forest from wildland, with a centre seed fallback.",
  },
  {
    definitionId: "seeds-on-the-wind",
    name: "Seeds on the Wind",
    category: "growth",
    copies: 2,
    summary: "Create forest and adjacent grassland on chosen land.",
  },
  {
    definitionId: "rain-on-barren-ground",
    name: "Rain on Barren Ground",
    category: "transformation",
    copies: 2,
    summary: "Convert barren tiles to grassland from a chosen anchor.",
  },
  {
    definitionId: "green-through-stone",
    name: "Green Through Stone",
    category: "recovery",
    copies: 2,
    summary: "Restore grassland on barren tiles, seeding forest if needed.",
  },
  {
    definitionId: "the-flood-comes",
    name: "The Flood Comes",
    category: "transformation",
    copies: 2,
    summary: "Spread water from existing water, or seed water if none exists.",
  },
  {
    definitionId: "river-finds-a-way",
    name: "River Finds a Way",
    category: "connection",
    copies: 1,
    summary: "Extend water from a source, seeding one if necessary.",
  },
  {
    definitionId: "settlement-spreads",
    name: "The Settlement Spreads",
    category: "growth",
    copies: 2,
    summary: "New village adjacent to an existing one.",
  },
  {
    definitionId: "urban-pressure",
    name: "Urban Pressure",
    category: "growth",
    copies: 1,
    summary: "Spread urban terrain from a town-or-larger region.",
  },
  {
    definitionId: "the-road-between",
    name: "The Road Between",
    category: "connection",
    copies: 3,
    summary: "Road to the nearest unconnected settlement.",
  },
  {
    definitionId: "the-long-road",
    name: "The Long Road",
    category: "connection",
    copies: 1,
    summary: "Long road between distant settlements, then retire.",
  },
  {
    definitionId: "crossroads",
    name: "Crossroads",
    category: "connection",
    copies: 1,
    summary: "Road from the network to an unconnected settlement.",
  },
  {
    definitionId: "the-waters-recede",
    name: "The Waters Recede",
    category: "transformation",
    copies: 1,
    summary: "Convert water to grassland once enough water exists.",
  },
  {
    definitionId: "desert-wind",
    name: "Desert Wind",
    category: "transformation",
    copies: 1,
    summary: "Spread desert once productive terrain is established.",
  },
  {
    definitionId: "the-land-breaks",
    name: "The Land Breaks",
    category: "transformation",
    copies: 1,
    summary: "Carve a short chasm, then retire.",
  },
  {
    definitionId: "settlement-abandoned",
    name: "Settlement Abandoned",
    category: "destruction",
    copies: 1,
    summary: "Advance decline on a vulnerable village.",
  },
  {
    definitionId: "road-blocked",
    name: "Road Blocked",
    category: "destruction",
    copies: 1,
    summary: "Mark a road tile as blocked.",
  },
  {
    definitionId: "the-chasm-marches",
    name: "The Chasm Marches",
    category: "destruction",
    copies: 1,
    summary: "Spread chasm once the map and a chasm are large enough.",
  },
  {
    definitionId: "the-emptying",
    name: "The Emptying",
    category: "destruction",
    copies: 1,
    summary: "Empty part of an urban region, leaving ruins.",
  },
  {
    definitionId: "reclamation",
    name: "Reclamation",
    category: "recovery",
    copies: 1,
    summary: "Restore a village from a ruin.",
  },
  {
    definitionId: "the-old-road-holds",
    name: "The Old Road Holds",
    category: "recovery",
    copies: 1,
    summary: "Protect tiles on the road network.",
  },
  {
    definitionId: "edge-of-the-known",
    name: "Edge of the Known",
    category: "expansion",
    copies: 2,
    summary: "Expand the map boundary by one tile.",
  },
  {
    definitionId: "new-country",
    name: "New Country",
    category: "expansion",
    copies: 1,
    summary: "Create new wildland beyond the edge, then retire.",
  },
  {
    definitionId: "echo-of-the-wild",
    name: "Echo of the Wild",
    category: "deck",
    copies: 1,
    summary: "Small wild spread; copy Creeping Wilds to discard.",
  },
  {
    definitionId: "forgotten-instruction",
    name: "Forgotten Instruction",
    category: "deck",
    copies: 1,
    summary: "Mark forgotten; retire a discard-pile card.",
  },
  {
    definitionId: "the-law-changes",
    name: "The Law Changes",
    category: "deck",
    copies: 1,
    summary: "Mark altered; modify a draw-pile card.",
  },
];

export function getManifestTotalCopies(
  manifest: DeckManifestEntry[] = FIRST_ADVANCED_TEST_DECK_MANIFEST,
): number {
  return manifest.reduce((total, entry) => total + entry.copies, 0);
}

export function getManifestDefinitionIds(
  manifest: DeckManifestEntry[] = FIRST_ADVANCED_TEST_DECK_MANIFEST,
): string[] {
  return manifest.map((entry) => entry.definitionId);
}

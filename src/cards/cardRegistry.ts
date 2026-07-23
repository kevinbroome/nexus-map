import type { CardDefinition } from "./cardTypes";
import { ADVANCED_DECK_CARDS } from "./advancedDeck/advancedDeckCards";
import { legacyCard } from "./defineCard";
import {
  ashWalkEffect,
  ashWalkTarget,
  creepingWildsIIEffect,
  creepingWildsIITarget,
  marchOfTheChasmEffect,
  marchOfTheChasmTarget,
  theFloodComesEffect,
  theFloodComesTarget,
} from "./cardPropagations";
import {
  connectedRegionTarget,
  distantFoundationsTarget,
  exactDistanceTarget,
  marchOfStoneTarget,
  nearestRoadTarget,
  ringOfAshTarget,
  singlePrimaryTileTarget,
  twoEndpointRouteTarget,
} from "./cardTargets";

const LEGACY_DEMO_CARDS: CardDefinition[] = [
  legacyCard({
    id: "waters-rise",
    name: "The Waters Rise",
    description: "Turn the selected location into water.",
    rulesText: "Turn the selected location into water.",
    category: "transformation",
    tags: ["terrain"],
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "water" }],
  }),
  legacyCard({
    id: "wild-growth",
    name: "The Wild Returns",
    description: "Turn the selected location into forest.",
    rulesText: "Turn the selected location into forest.",
    category: "growth",
    tags: ["terrain"],
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "forest" }],
  }),
  legacyCard({
    id: "new-foundations",
    name: "New Foundations",
    description: "Create a village on the selected land tile.",
    rulesText: "Create a village on the selected land tile.",
    category: "creation",
    tags: ["settlement"],
    target: singlePrimaryTileTarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "has-no-settlement" },
    ],
    effects: [{ type: "add-settlement", settlementType: "village" }],
  }),
  legacyCard({
    id: "wild-consumes-itself",
    name: "The Wild Consumes Itself",
    description:
      "Mark every tile in the connected forest region with the ancient tag.",
    rulesText:
      "Mark every tile in the connected forest region with the ancient tag.",
    category: "growth",
    tags: ["terrain"],
    target: connectedRegionTarget("forest"),
    conditions: [{ type: "terrain-is", terrain: "forest" }],
    effects: [{ type: "add-tag", tag: "ancient" }],
  }),
  legacyCard({
    id: "distant-foundations",
    name: "Distant Foundations",
    description:
      "From the selected tile, place a village on one random valid tile exactly three spaces away.",
    rulesText:
      "From the selected tile, place a village on one random valid tile exactly three spaces away.",
    category: "creation",
    tags: ["settlement"],
    target: distantFoundationsTarget(),
    conditions: [],
    effects: [{ type: "add-settlement", settlementType: "village" }],
  }),
  legacyCard({
    id: "march-of-stone",
    name: "March of Stone",
    description:
      "Spread mountain terrain in a straight line in a random cardinal direction.",
    rulesText:
      "Spread mountain terrain in a straight line in a random cardinal direction.",
    category: "creation",
    tags: ["terrain"],
    target: marchOfStoneTarget(),
    conditions: [],
    effects: [{ type: "set-terrain", terrain: "mountain" }],
  }),
  legacyCard({
    id: "the-nearest-road",
    name: "The Nearest Road",
    description:
      "Create a road from the selected settlement to the nearest unconnected settlement.",
    rulesText:
      "Create a road from the selected settlement to the nearest unconnected settlement.",
    category: "connection",
    tags: ["road", "settlement"],
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
  }),
  legacyCard({
    id: "ring-of-ash",
    name: "Ring of Ash",
    description: "Surround the selected tile with a ring of ash-tagged tiles.",
    rulesText: "Surround the selected tile with a ring of ash-tagged tiles.",
    category: "destruction",
    tags: ["terrain"],
    target: ringOfAshTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "ash" }],
  }),
  legacyCard({
    id: "creeping-wilds-ii",
    name: "Creeping Wilds II",
    description:
      "Spread forest outward from wild terrain, avoiding mountains and urban resistance.",
    rulesText:
      "Spread forest outward from wildland, avoiding mountains and urban resistance.",
    category: "growth",
    tags: ["terrain"],
    target: creepingWildsIITarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
    ],
    effects: [creepingWildsIIEffect()],
  }),
  legacyCard({
    id: "march-of-the-chasm",
    name: "March of the Chasm",
    description:
      "Carve a chasm in a random cardinal direction, pushing through resistance.",
    rulesText:
      "Carve a chasm in a random cardinal direction, pushing through resistance.",
    category: "destruction",
    tags: ["terrain"],
    target: marchOfTheChasmTarget(),
    conditions: [],
    effects: [marchOfTheChasmEffect()],
  }),
  legacyCard({
    id: "ash-walk",
    name: "Ash Walk",
    description: "Leave an ash trail by random walk, stopping before water or chasms.",
    rulesText: "Leave an ash trail by random walk, stopping before water or chasms.",
    category: "destruction",
    tags: ["terrain"],
    target: ashWalkTarget(),
    conditions: [],
    effects: [ashWalkEffect()],
  }),
];

const LEGACY_DEV_CARDS: CardDefinition[] = [
  legacyCard({
    id: "dev-tile-road",
    name: "Dev Tile Road",
    description: "Development card: create a road between two selected tiles.",
    rulesText: "Development card: create a road between two selected tiles.",
    category: "connection",
    tags: ["road"],
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
  }),
  legacyCard({
    id: "the-last-flood",
    name: "The Last Flood",
    description:
      "Spread water like The Flood Comes, then retire this card after a successful play.",
    rulesText:
      "Spread water like The Flood Comes, then retire this card after a successful play.",
    category: "transformation",
    tags: ["terrain", "rare"],
    target: theFloodComesTarget(),
    conditions: [{ type: "terrain-is", terrain: "water" }],
    effects: [theFloodComesEffect()],
    deckMutations: [{ type: "retire-self" }],
    failureBehaviours: {
      propagation: { type: "reduce-magnitude", minimum: 2, decrement: 1 },
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),
  legacyCard({
    id: "second-attempt",
    name: "Second Attempt",
    description:
      "Target a tile exactly four spaces away; retarget to three, then two, on failure.",
    rulesText:
      "Target a tile exactly four spaces away; retarget to three, then two, on failure.",
    category: "deck",
    tags: ["rare"],
    target: exactDistanceTarget(4),
    conditions: [],
    effects: [{ type: "add-tag", tag: "second-attempt" }],
    failureBehaviours: {
      selection: { type: "retarget", target: exactDistanceTarget(3) },
      "target-requirements": {
        type: "retarget",
        target: exactDistanceTarget(2),
      },
    },
    defaultFailureBehaviour: { type: "fail" },
  }),
  legacyCard({
    id: "lesser-consequence",
    name: "Lesser Consequence",
    description:
      "Attempt a large forest spread; on failure apply a smaller effect to the selection.",
    rulesText:
      "Attempt a large forest spread; on failure apply a smaller effect to the selection.",
    category: "growth",
    tags: ["terrain"],
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [creepingWildsIIEffect()],
    failureBehaviours: {
      propagation: {
        type: "apply-fallback-effect",
        effects: [{ type: "add-tag", tag: "lesser-consequence" }],
      },
    },
    defaultFailureBehaviour: { type: "fail" },
  }),
];

const advancedDeckIds = new Set(ADVANCED_DECK_CARDS.map((card) => card.id));

const LEGACY_CARDS_WITHOUT_ADVANCED_OVERLAP = LEGACY_DEMO_CARDS.filter(
  (card) => !advancedDeckIds.has(card.id),
);

export function getAllCardDefinitions(): CardDefinition[] {
  return [
    ...ADVANCED_DECK_CARDS,
    ...LEGACY_CARDS_WITHOUT_ADVANCED_OVERLAP,
    ...LEGACY_DEV_CARDS,
  ];
}

export function getCardDefinition(id: string): CardDefinition | undefined {
  return getAllCardDefinitions().find((entry) => entry.id === id);
}

/** Backward-compatible flat registry used by legacy tests and migrations. */
export const cards: CardDefinition[] = getAllCardDefinitions();

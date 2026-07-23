import type { CardDefinition } from "./cardTypes";
import {
  adjacentPrimaryTarget,
  connectedRegionTarget,
  distantFoundationsTarget,
  exactDistanceTarget,
  edgeOfTheKnownTarget,
  marchOfStoneTarget,
  nearestRoadTarget,
  ringOfAshTarget,
  singlePrimaryTileTarget,
  twoEndpointRouteTarget,
} from "./cardTargets";
import {
  ashWalkEffect,
  ashWalkTarget,
  creepingWildsIIEffect,
  creepingWildsIITarget,
  marchOfTheChasmEffect,
  marchOfTheChasmTarget,
  theFloodComesEffect,
  theFloodComesTarget,
  theOldRoadHoldsEffect,
  theOldRoadHoldsTarget,
} from "./cardPropagations";

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
  {
    id: "creeping-wilds-ii",
    name: "Creeping Wilds II",
    description:
      "Spread forest outward from wild terrain, avoiding mountains and urban resistance.",
    target: creepingWildsIITarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
    ],
    effects: [creepingWildsIIEffect()],
  },
  {
    id: "the-flood-comes",
    name: "The Flood Comes",
    description: "Spread water outward, creating new shoreline tiles when needed.",
    target: theFloodComesTarget(),
    conditions: [{ type: "terrain-is", terrain: "water" }],
    effects: [theFloodComesEffect()],
  },
  {
    id: "march-of-the-chasm",
    name: "March of the Chasm",
    description:
      "Carve a chasm in a random cardinal direction, pushing through resistance.",
    target: marchOfTheChasmTarget(),
    conditions: [],
    effects: [marchOfTheChasmEffect()],
  },
  {
    id: "the-old-road-holds",
    name: "The Old Road Holds",
    description: "Mark tiles along the connected road network as protected.",
    target: theOldRoadHoldsTarget(),
    conditions: [],
    effects: [theOldRoadHoldsEffect()],
  },
  {
    id: "ash-walk",
    name: "Ash Walk",
    description: "Leave an ash trail by random walk, stopping before water or chasms.",
    target: ashWalkTarget(),
    conditions: [],
    effects: [ashWalkEffect()],
  },
  {
    id: "the-last-flood",
    name: "The Last Flood",
    description:
      "Spread water like The Flood Comes, then retire this card after a successful play.",
    target: theFloodComesTarget(),
    conditions: [{ type: "terrain-is", terrain: "water" }],
    effects: [theFloodComesEffect()],
    deckMutations: [{ type: "retire-self" }],
    failureBehaviours: {
      propagation: { type: "reduce-magnitude", minimum: 2, decrement: 1 },
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  },
  {
    id: "echo-of-the-wild",
    name: "Echo of the Wild",
    description: "Spread forest, then copy this card into the discard pile.",
    target: creepingWildsIITarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
    ],
    effects: [creepingWildsIIEffect()],
    deckMutations: [
      {
        type: "copy-card",
        selector: { type: "self" },
        count: { type: "fixed", value: 1 },
        destination: "discard",
      },
    ],
  },
  {
    id: "the-law-changes",
    name: "The Law Changes",
    description:
      "Mark the selected tile, then alter one random draw-pile card (+1 magnitude, altered tag).",
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "marked-by-law" }],
    deckMutations: [
      {
        type: "modify-card",
        selector: { type: "random-from-draw" },
        modification: { type: "magnitude-adjustment", amount: 1 },
      },
      {
        type: "modify-card",
        selector: { type: "random-from-draw" },
        modification: { type: "add-tag", tag: "altered" },
      },
    ],
  },
  {
    id: "forgotten-instruction",
    name: "Forgotten Instruction",
    description:
      "Mark a valid tile as forgotten, then retire one random discard-pile card.",
    target: singlePrimaryTileTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "forgotten" }],
    deckMutations: [
      {
        type: "retire-card",
        selector: { type: "random-from-discard" },
      },
    ],
  },
  {
    id: "second-attempt",
    name: "Second Attempt",
    description:
      "Target a tile exactly four spaces away; retarget to three, then two, on failure.",
    target: exactDistanceTarget(4),
    conditions: [],
    effects: [{ type: "add-tag", tag: "second-attempt" }],
    failureBehaviours: {
      selection: { type: "retarget", target: exactDistanceTarget(3) },
      "target-requirements": { type: "retarget", target: exactDistanceTarget(2) },
    },
    defaultFailureBehaviour: { type: "fail" },
  },
  {
    id: "lesser-consequence",
    name: "Lesser Consequence",
    description:
      "Attempt a large forest spread; on failure apply a smaller effect to the selection.",
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
  },
];

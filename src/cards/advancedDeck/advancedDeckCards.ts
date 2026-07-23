import { defineCard } from "../defineCard";
import type { CardDefinition } from "../cardTypes";
import {
  autoCentreTileTarget,
  crossroadsTarget,
  desertWindOriginTarget,
  firstFoundationsTarget,
  forgottenInstructionTarget,
  greenThroughStoneTarget,
  landBreaksOriginTarget,
  longRoadTarget,
  nearestRoadTarget,
  randomBoundaryOriginTarget,
  randomChasmOriginTarget,
  randomNonWaterOriginTarget,
  randomSettlementRegionOriginTarget,
  randomWaterOriginTarget,
  randomWildTerrainOriginTarget,
  roadBlockedTarget,
  roadNetworkOriginTarget,
  ruinTarget,
  settlementAbandonedTarget,
  settlementSpreadTarget,
  theLawChangesTarget,
  urbanRegionTarget,
} from "../cardTargets";
import {
  chasmMarchesEffect,
  creepingWildsDeckEffect,
  desertWindEffect,
  echoWildSpreadEffect,
  edgeExpansionEffect,
  landBreaksEffect,
  newCountryEffect,
  stoneRisingEffect,
  theFloodComesEffect,
  theOldRoadHoldsEffect,
  urbanPressureEffect,
  watersRecedeEffect,
} from "../cardPropagations";

export const ADVANCED_DECK_CARDS: CardDefinition[] = [
  defineCard({
    id: "green-beginning",
    name: "Green Beginning",
    category: "creation",
    tags: ["terrain"],
    flavourText: "Before the roads, the wildland remembered itself.",
    rulesText:
      "At the world centre, set one empty or grassland tile to grassland or forest. On failure, retarget to the nearest valid tile.",
    target: autoCentreTileTarget([
      { type: "terrain-in", terrains: ["empty", "grassland"] },
    ]),
    conditions: [],
    effects: [{ type: "set-random-terrain", terrains: ["grassland", "forest"] }],
    failureBehaviours: {
      selection: { type: "nearest-valid-target" },
    },
  }),

  defineCard({
    id: "first-foundations",
    name: "First Foundations",
    category: "creation",
    tags: ["settlement"],
    flavourText: "Someone decides to stay.",
    rulesText:
      "Create a village on a random non-water, non-chasm tile without a settlement. On failure, choose a random valid tile.",
    target: firstFoundationsTarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
      { type: "has-no-settlement" },
    ],
    effects: [{ type: "add-settlement", settlementType: "village" }],
    failureBehaviours: {
      selection: { type: "random-valid-target" },
    },
  }),

  defineCard({
    id: "stone-rising",
    name: "Stone Rising",
    category: "creation",
    tags: ["terrain"],
    flavourText: "The ground folds upward and will not be moved.",
    rulesText:
      "From a random non-water tile, spread mountain in a clustered line through 3–5 tiles. Chasm cannot be replaced.",
    target: randomNonWaterOriginTarget(),
    conditions: [{ type: "terrain-is-not", terrain: "water" }],
    effects: [stoneRisingEffect()],
  }),

  defineCard({
    id: "creeping-wilds",
    name: "Creeping Wilds",
    category: "growth",
    tags: ["terrain"],
    flavourText: "The forest does not ask permission.",
    rulesText:
      "From random forest or grassland, spread forest through 4–7 tiles. Urban terrain resists; mountains block.",
    target: randomWildTerrainOriginTarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
    ],
    effects: [creepingWildsDeckEffect()],
  }),

  defineCard({
    id: "settlement-spreads",
    name: "The Settlement Spreads",
    category: "growth",
    tags: ["settlement"],
    flavourText: "One hearth becomes two.",
    rulesText:
      "From a random village, create another village on the nearest valid neighbouring land tile. On failure, discard.",
    target: settlementSpreadTarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
      { type: "has-no-settlement" },
    ],
    effects: [{ type: "add-settlement", settlementType: "village" }],
    failureBehaviours: {
      selection: { type: "discard" },
      "target-requirements": { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "urban-pressure",
    name: "Urban Pressure",
    category: "growth",
    tags: ["settlement", "terrain"],
    flavourText: "Stone replaces soil where people gather.",
    rulesText:
      "From a random town-or-larger settlement region, spread urban terrain through 3–6 nearby land tiles based on settlement tier.",
    target: randomSettlementRegionOriginTarget(),
    conditions: [],
    effects: [urbanPressureEffect()],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-road-between",
    name: "The Road Between",
    category: "connection",
    tags: ["road", "settlement"],
    flavourText: "Distance shrinks when stone connects hearths.",
    rulesText:
      "From a settlement, create a road to the nearest unconnected settlement. On failure, try a random valid settlement, then discard.",
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
    failureBehaviours: {
      selection: { type: "random-valid-target" },
      "target-requirements": { type: "discard" },
      "route-pathfinding": { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-long-road",
    name: "The Long Road",
    category: "connection",
    tags: ["road", "settlement", "rare"],
    flavourText: "Some journeys change the map forever.",
    rulesText:
      "Create a road from a settlement to the farthest valid settlement within range, then retire this card.",
    target: longRoadTarget(),
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
    deckMutations: [{ type: "retire-self" }],
    failureBehaviours: {
      selection: { type: "discard" },
      "target-requirements": { type: "discard" },
      "route-pathfinding": { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "crossroads",
    name: "Crossroads",
    category: "connection",
    tags: ["road", "rare"],
    flavourText: "Where paths meet, new paths are born.",
    rulesText:
      "From a road tile, create a road to the nearest unconnected settlement, preferring the existing network.",
    target: crossroadsTarget(),
    conditions: [],
    effects: [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        preferExistingNetwork: true,
        allowedNodeTypes: ["village", "settlement-region", "tile"],
      },
    ],
    failureBehaviours: {
      selection: { type: "discard" },
      "route-pathfinding": { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-flood-comes",
    name: "The Flood Comes",
    category: "transformation",
    tags: ["terrain"],
    flavourText: "Water remembers every road built across it.",
    rulesText:
      "From random water, spread water through 4–8 nearby tiles. On failure with no water, discard.",
    target: randomWaterOriginTarget(),
    conditions: [{ type: "terrain-is", terrain: "water" }],
    effects: [theFloodComesEffect()],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-waters-recede",
    name: "The Waters Recede",
    category: "transformation",
    tags: ["terrain", "rare"],
    flavourText: "The shore withdraws, leaving mud and memory.",
    rulesText:
      "From random water, convert 2–4 water tiles to grassland along a random frontier.",
    target: randomWaterOriginTarget(),
    conditions: [{ type: "terrain-is", terrain: "water" }],
    effects: [watersRecedeEffect()],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "desert-wind",
    name: "Desert Wind",
    category: "transformation",
    tags: ["terrain"],
    flavourText: "Dry air carries the colour of distance.",
    rulesText:
      "From empty, grassland, or desert, spread desert directionally through 3–6 tiles.",
    target: desertWindOriginTarget(),
    conditions: [],
    effects: [desertWindEffect()],
  }),

  defineCard({
    id: "the-land-breaks",
    name: "The Land Breaks",
    category: "transformation",
    tags: ["terrain", "rare"],
    flavourText: "The earth opens and does not close.",
    rulesText:
      "Carve a short chasm line of 3 tiles from a random valid origin, then retire this card.",
    target: landBreaksOriginTarget(),
    conditions: [{ type: "terrain-is-not", terrain: "chasm" }],
    effects: [landBreaksEffect()],
    deckMutations: [{ type: "retire-self" }],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "settlement-abandoned",
    name: "Settlement Abandoned",
    category: "destruction",
    tags: ["settlement"],
    flavourText: "The last cart leaves before the sand arrives.",
    rulesText:
      "On a village in empty or desert terrain, advance village decline. On failure, target the nearest eligible village.",
    target: settlementAbandonedTarget(),
    conditions: [
      { type: "has-settlement" },
      { type: "terrain-is-not", terrain: "water" },
    ],
    effects: [{ type: "advance-village-decline", amount: 1 }],
    failureBehaviours: {
      selection: { type: "nearest-valid-target" },
    },
  }),

  defineCard({
    id: "road-blocked",
    name: "Road Blocked",
    category: "destruction",
    tags: ["road", "rare"],
    flavourText: "The way is still there, but no one trusts it.",
    rulesText:
      "Mark a random road tile with the road-blocked tag. Route removal is not yet implemented.",
    target: roadBlockedTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "road-blocked" }],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-chasm-marches",
    name: "The Chasm Marches",
    category: "destruction",
    tags: ["terrain", "rare"],
    flavourText: "The crack walks on.",
    rulesText:
      "From random chasm, spread chasm directionally through 3–5 tiles. On failure, discard.",
    target: randomChasmOriginTarget(),
    conditions: [],
    effects: [chasmMarchesEffect()],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-emptying",
    name: "The Emptying",
    category: "destruction",
    tags: ["terrain", "settlement", "ruin", "rare"],
    flavourText: "Cities forget their own names.",
    rulesText:
      "On a random urban region, empty up to 3 urban tiles and leave ruins where settlements are removed.",
    target: urbanRegionTarget(),
    conditions: [{ type: "terrain-is", terrain: "urban" }],
    effects: [{ type: "empty-urban-region", tileLimit: 3, leaveRuins: true }],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "reclamation",
    name: "Reclamation",
    category: "recovery",
    tags: ["settlement", "ruin", "rare"],
    flavourText: "Ruins can become hearths again.",
    rulesText: "On a random ruin, restore a village and remove the ruined tag. Terrain is unchanged.",
    target: ruinTarget(),
    conditions: [{ type: "has-settlement" }],
    effects: [{ type: "restore-village-from-ruin" }],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "green-through-stone",
    name: "Green Through Stone",
    category: "recovery",
    tags: ["terrain", "rare"],
    flavourText: "Life finds the seam between desert and forest.",
    rulesText:
      "On empty or desert adjacent to forest, set terrain to grassland or forest.",
    target: greenThroughStoneTarget(),
    conditions: [{ type: "adjacent-to-terrain", terrain: "forest" }],
    effects: [{ type: "set-random-terrain", terrains: ["grassland", "forest"] }],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-old-road-holds",
    name: "The Old Road Holds",
    category: "recovery",
    tags: ["road", "rare"],
    flavourText: "Some paths endure what the land cannot.",
    rulesText:
      "From the road network, mark up to 6 road tiles with the protected tag.",
    target: roadNetworkOriginTarget(),
    conditions: [],
    effects: [theOldRoadHoldsEffect()],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "edge-of-the-known",
    name: "Edge of the Known",
    category: "expansion",
    tags: ["boundary"],
    flavourText: "The map ends where someone has not yet walked.",
    rulesText: "From a random boundary tile, create one adjacent empty tile.",
    target: randomBoundaryOriginTarget(),
    conditions: [],
    effects: [edgeExpansionEffect()],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "new-country",
    name: "New Country",
    category: "expansion",
    tags: ["boundary", "terrain", "rare"],
    flavourText: "Beyond the edge, land appears as if it had always waited.",
    rulesText:
      "From a random boundary tile, create 3–5 new empty or grassland tiles, then retire this card.",
    target: randomBoundaryOriginTarget(),
    conditions: [],
    effects: [newCountryEffect()],
    deckMutations: [{ type: "retire-self" }],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "echo-of-the-wild",
    name: "Echo of the Wild",
    category: "deck",
    tags: ["terrain", "rare"],
    flavourText: "The forest repeats itself in the discard pile.",
    rulesText:
      "Spread forest or grassland through 3 tiles, then copy Creeping Wilds into the discard pile.",
    target: randomWildTerrainOriginTarget(),
    conditions: [
      { type: "terrain-is-not", terrain: "water" },
      { type: "terrain-is-not", terrain: "chasm" },
    ],
    effects: [echoWildSpreadEffect()],
    deckMutations: [
      {
        type: "copy-card",
        selector: { type: "definition-id", definitionId: "creeping-wilds" },
        count: { type: "fixed", value: 1 },
        destination: "discard",
      },
    ],
    failureBehaviours: {
      selection: { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "forgotten-instruction",
    name: "Forgotten Instruction",
    category: "deck",
    tags: ["rare"],
    flavourText: "A rule is written, then erased.",
    rulesText:
      "Mark a tile as forgotten, then retire one random card from the discard pile. On failure, discard.",
    target: forgottenInstructionTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "forgotten" }],
    deckMutations: [
      {
        type: "retire-card",
        selector: { type: "random-from-discard" },
      },
    ],
    defaultFailureBehaviour: { type: "discard" },
  }),

  defineCard({
    id: "the-law-changes",
    name: "The Law Changes",
    category: "deck",
    tags: ["rare"],
    flavourText: "The rules bend before the next hand is drawn.",
    rulesText:
      "Mark a tile as altered, then modify one random draw-pile card (+1 magnitude and altered tag).",
    target: theLawChangesTarget(),
    conditions: [],
    effects: [{ type: "add-tag", tag: "altered" }],
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
    failureBehaviours: {
      selection: { type: "discard" },
      "deck-mutation": { type: "discard" },
    },
    defaultFailureBehaviour: { type: "discard" },
  }),
];

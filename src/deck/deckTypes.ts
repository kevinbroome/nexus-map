import type { CardDefinition } from "../cards/cardTypes";
import type { ResistanceDefinition } from "../rules/propagation/types";
import type { NumberDefinition, TargetFilterDefinition } from "../rules/targeting/types";
import type { TerrainType } from "../world/worldTypes";

export type DeckDestination =
  | "draw-top"
  | "draw-bottom"
  | "draw-random"
  | "discard"
  | "retired";

export type CardModificationType = CardModification["type"];

export type CardModification =
  | { type: "magnitude-adjustment"; amount: number }
  | { type: "add-target-filter"; filter: TargetFilterDefinition }
  | { type: "remove-target-filter"; filterIndex: number }
  | { type: "replace-operation-terrain"; terrain: TerrainType }
  | { type: "add-resistance"; resistance: ResistanceDefinition }
  | { type: "add-tag"; tag: string }
  | { type: "rename"; name: string };

export type CardModificationDefinition = CardModification;

export interface DeckCardInstance {
  instanceId: string;
  definitionId: string;
  createdTurn: number;
  createdByActionId?: string;
  modifications: CardModification[];
  tags: string[];
}

export interface DeckState {
  drawPile: DeckCardInstance[];
  discardPile: DeckCardInstance[];
  retiredPile: DeckCardInstance[];
  activeInstanceId?: string;
  activeInstance?: DeckCardInstance;
  shuffleCount: number;
}

export type DeckCardSelector =
  | { type: "self" }
  | { type: "active-card" }
  | { type: "previously-played-card" }
  | { type: "definition-id"; definitionId: string }
  | { type: "instance-id"; instanceId: string }
  | { type: "random-from-draw" }
  | { type: "random-from-discard" }
  | { type: "random-from-any-active-pile" }
  | { type: "tag"; tag: string }
  | { type: "highest-magnitude" }
  | { type: "lowest-magnitude" };

export type DeckMutationDefinition =
  | { type: "retire-self" }
  | {
      type: "return-self";
      destination: "draw-top" | "draw-bottom" | "discard";
    }
  | { type: "retire-card"; selector: DeckCardSelector }
  | {
      type: "copy-card";
      selector: DeckCardSelector;
      count: NumberDefinition;
      destination: DeckDestination;
    }
  | {
      type: "add-card";
      definitionId: string;
      count: NumberDefinition;
      destination: DeckDestination;
    }
  | {
      type: "modify-card";
      selector: DeckCardSelector;
      modification: CardModificationDefinition;
    }
  | {
      type: "remove-modification";
      selector: DeckCardSelector;
      modificationType?: CardModificationType;
    }
  | { type: "shuffle"; source: "discard-into-draw" | "draw-pile" };

export type DeckMutationRecord =
  | {
      type: "card-added";
      instance: DeckCardInstance;
      destination: DeckDestination;
    }
  | {
      type: "card-copied";
      sourceInstanceId: string;
      createdInstanceIds: string[];
      destination: DeckDestination;
    }
  | { type: "card-retired"; instanceId: string }
  | {
      type: "card-modified";
      instanceId: string;
      modification: CardModification;
    }
  | {
      type: "modification-removed";
      instanceId: string;
      removed: CardModification[];
    }
  | {
      type: "pile-shuffled";
      source: string;
      resultingOrder: string[];
      seed: string;
    }
  | {
      type: "active-card-moved";
      instanceId: string;
      destination: DeckDestination;
    };

export interface ProposedDeckChange {
  before: DeckState;
  after: DeckState;
  mutations: DeckMutationRecord[];
}

export interface DeckOperationResult {
  ok: boolean;
  deck: DeckState;
  messages: string[];
  mutations: DeckMutationRecord[];
  drawnInstance?: DeckCardInstance;
  shuffled?: boolean;
  shuffleSeed?: string;
}

export interface CardCopyContext {
  turn: number;
  actionId: string;
  randomSeed: string;
  copySequenceStart?: number;
}

export interface EffectiveCardDefinition extends CardDefinition {
  instanceId: string;
  baseDefinitionId: string;
  appliedModifications: CardModification[];
  modificationSummary: string[];
}

export function cloneDeckInstance(instance: DeckCardInstance): DeckCardInstance {
  return structuredClone(instance);
}

export function cloneDeckState(deck: DeckState): DeckState {
  return {
    drawPile: deck.drawPile.map(cloneDeckInstance),
    discardPile: deck.discardPile.map(cloneDeckInstance),
    retiredPile: deck.retiredPile.map(cloneDeckInstance),
    activeInstanceId: deck.activeInstanceId,
    activeInstance: deck.activeInstance
      ? cloneDeckInstance(deck.activeInstance)
      : undefined,
    shuffleCount: deck.shuffleCount,
  };
}

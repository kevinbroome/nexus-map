import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import type { WorldState } from "../world/worldTypes";
import type { SelectionState } from "../selection/selectionTypes";
import { getLatestActionSequence } from "../world/commitWorldAction";
import { formatSelection } from "../selection/selection";
import { formatProposalMessage } from "../rules/engine";

export type AppState = {
  world: WorldState | null;
  selection: SelectionState;
  drawnCard: CardDefinition | null;
  proposedAction: ProposedAction | null;
  statusMessage: string;
  loadError: string | null;
};

export type SidebarElements = {
  selectedLocation: HTMLParagraphElement;
  statusMessage: HTMLParagraphElement;
  recoveryPanel: HTMLElement;
  createNewWorldButton: HTMLButtonElement;
  selectionModeInputs: NodeListOf<HTMLInputElement>;
  drawCardButton: HTMLButtonElement;
  cardPanel: HTMLElement;
  cardName: HTMLHeadingElement;
  cardDescription: HTMLParagraphElement;
  cardValidation: HTMLParagraphElement;
  applyCardButton: HTMLButtonElement;
  discardCardButton: HTMLButtonElement;
};

export function getSidebarElements(): SidebarElements {
  const selectedLocation = document.querySelector<HTMLParagraphElement>(
    "#selected-location",
  );
  const statusMessage = document.querySelector<HTMLParagraphElement>(
    "#status-message",
  );
  const recoveryPanel = document.querySelector<HTMLElement>("#recovery-panel");
  const createNewWorldButton = document.querySelector<HTMLButtonElement>(
    "#create-new-world",
  );
  const selectionModeInputs = document.querySelectorAll<HTMLInputElement>(
    'input[name="selection-mode"]',
  );
  const drawCardButton = document.querySelector<HTMLButtonElement>("#draw-card");
  const cardPanel = document.querySelector<HTMLElement>("#card-panel");
  const cardName = document.querySelector<HTMLHeadingElement>("#card-name");
  const cardDescription = document.querySelector<HTMLParagraphElement>(
    "#card-description",
  );
  const cardValidation = document.querySelector<HTMLParagraphElement>(
    "#card-validation",
  );
  const applyCardButton =
    document.querySelector<HTMLButtonElement>("#apply-card");
  const discardCardButton =
    document.querySelector<HTMLButtonElement>("#discard-card");

  if (
    !selectedLocation ||
    !statusMessage ||
    !recoveryPanel ||
    !createNewWorldButton ||
    selectionModeInputs.length === 0 ||
    !drawCardButton ||
    !cardPanel ||
    !cardName ||
    !cardDescription ||
    !cardValidation ||
    !applyCardButton ||
    !discardCardButton
  ) {
    throw new Error("Sidebar elements are missing from the page.");
  }

  return {
    selectedLocation,
    statusMessage,
    recoveryPanel,
    createNewWorldButton,
    selectionModeInputs,
    drawCardButton,
    cardPanel,
    cardName,
    cardDescription,
    cardValidation,
    applyCardButton,
    discardCardButton,
  };
}

export function renderSidebar(
  elements: SidebarElements,
  state: AppState,
): void {
  const interactionsDisabled = state.world === null;
  const proposalMessage = state.proposedAction
    ? formatProposalMessage(state.proposedAction)
    : "";
  const canApply = state.proposedAction?.valid ?? false;

  elements.selectedLocation.textContent = state.world
    ? formatSelection(state.world, state.selection)
    : "Map unavailable";
  elements.statusMessage.textContent = state.loadError ?? state.statusMessage;
  elements.statusMessage.dataset.error = state.loadError ? "true" : "false";
  elements.recoveryPanel.hidden = state.loadError === null;

  elements.drawCardButton.disabled = interactionsDisabled;
  elements.discardCardButton.disabled = interactionsDisabled;

  for (const input of elements.selectionModeInputs) {
    input.checked = input.value === state.selection.mode;
    input.disabled = interactionsDisabled;
  }

  if (state.drawnCard && state.world) {
    elements.cardPanel.hidden = false;
    elements.cardName.textContent = state.drawnCard.name;
    elements.cardDescription.textContent = state.drawnCard.description;
    elements.cardValidation.textContent = proposalMessage;
    elements.cardValidation.dataset.valid = canApply ? "true" : "false";
    elements.applyCardButton.disabled = !canApply;
  } else {
    elements.cardPanel.hidden = true;
    elements.cardName.textContent = "";
    elements.cardDescription.textContent = "";
    elements.cardValidation.textContent = "";
    elements.applyCardButton.disabled = true;
  }
}

export function formatLoadedWorldMessage(world: WorldState): string {
  const latestAction = getLatestActionSequence(world);

  if (latestAction === 0) {
    return "Loaded saved world.";
  }

  return `Loaded saved world. Latest action #${latestAction}.`;
}

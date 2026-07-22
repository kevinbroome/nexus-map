import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import type { WorldState } from "../world/worldTypes";
import type { SelectionState } from "../selection/selectionTypes";
import { getLatestActionSequence } from "../world/commitWorldAction";
import {
  getConnectedRegion,
  getConnectedSettlementCluster,
  getExistingNeighbours,
  matchesTerrain,
} from "../world/neighbours";
import { isBoundaryTile } from "../world/tileCreation";
import {
  formatSelection,
  getPrimarySelectedTileId,
} from "../selection/selection";
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
  devExpandTileButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  cardPanel: HTMLElement;
  cardName: HTMLHeadingElement;
  cardDescription: HTMLParagraphElement;
  cardValidation: HTMLParagraphElement;
  applyCardButton: HTMLButtonElement;
  discardCardButton: HTMLButtonElement;
  devInspectionCardinal: HTMLParagraphElement;
  devInspectionAll: HTMLParagraphElement;
  devInspectionRegion: HTMLParagraphElement;
  devInspectionSettlement: HTMLParagraphElement;
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
  const devExpandTileButton =
    document.querySelector<HTMLButtonElement>("#dev-expand-tile");
  const exportButton = document.querySelector<HTMLButtonElement>("#export-world");
  const importButton = document.querySelector<HTMLButtonElement>("#import-world");
  const importInput = document.querySelector<HTMLInputElement>("#import-input");
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
  const devInspectionCardinal = document.querySelector<HTMLParagraphElement>(
    "#dev-inspection-cardinal",
  );
  const devInspectionAll = document.querySelector<HTMLParagraphElement>(
    "#dev-inspection-all",
  );
  const devInspectionRegion = document.querySelector<HTMLParagraphElement>(
    "#dev-inspection-region",
  );
  const devInspectionSettlement = document.querySelector<HTMLParagraphElement>(
    "#dev-inspection-settlement",
  );

  if (
    !selectedLocation ||
    !statusMessage ||
    !recoveryPanel ||
    !createNewWorldButton ||
    selectionModeInputs.length === 0 ||
    !drawCardButton ||
    !devExpandTileButton ||
    !exportButton ||
    !importButton ||
    !importInput ||
    !cardPanel ||
    !cardName ||
    !cardDescription ||
    !cardValidation ||
    !applyCardButton ||
    !discardCardButton ||
    !devInspectionCardinal ||
    !devInspectionAll ||
    !devInspectionRegion ||
    !devInspectionSettlement
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
    devExpandTileButton,
    exportButton,
    importButton,
    importInput,
    cardPanel,
    cardName,
    cardDescription,
    cardValidation,
    applyCardButton,
    discardCardButton,
    devInspectionCardinal,
    devInspectionAll,
    devInspectionRegion,
    devInspectionSettlement,
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
  elements.exportButton.disabled = interactionsDisabled;
  elements.importButton.disabled = interactionsDisabled;

  const selectedTileId = state.world
    ? getPrimarySelectedTileId(state.selection)
    : null;
  const canExpand =
    !!state.world &&
    !!selectedTileId &&
    isBoundaryTile(state.world, selectedTileId);

  elements.devExpandTileButton.disabled =
    interactionsDisabled || !canExpand;

  if (state.world && selectedTileId && state.world.tiles[selectedTileId]) {
    const selectedTile = state.world.tiles[selectedTileId]!;
    const cardinalCount = getExistingNeighbours(
      state.world,
      selectedTileId,
      "cardinal",
    ).length;
    const allCount = getExistingNeighbours(
      state.world,
      selectedTileId,
      "all",
    ).length;
    const regionCount = getConnectedRegion(
      state.world,
      selectedTileId,
      matchesTerrain(selectedTile.terrain),
      "cardinal",
    ).length;
    const settlementCount = selectedTile.settlement
      ? getConnectedSettlementCluster(state.world, selectedTileId, "cardinal")
          .length
      : 0;

    elements.devInspectionCardinal.textContent = `Cardinal neighbours: ${cardinalCount}`;
    elements.devInspectionAll.textContent = `All neighbours: ${allCount}`;
    elements.devInspectionRegion.textContent = `Connected terrain region: ${regionCount}`;
    elements.devInspectionSettlement.textContent = `Settlement cluster: ${settlementCount}`;
  } else {
    elements.devInspectionCardinal.textContent = "Cardinal neighbours: —";
    elements.devInspectionAll.textContent = "All neighbours: —";
    elements.devInspectionRegion.textContent = "Connected terrain region: —";
    elements.devInspectionSettlement.textContent = "Settlement cluster: —";
  }

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

import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import type { WorldState } from "../world/worldTypes";
import { isRuinSettlement, isVillageSettlement } from "../world/worldTypes";
import type { SelectionState } from "../selection/selectionTypes";
import { getLatestActionSequence } from "../world/commitWorldAction";
import {
  getConnectedRegion,
  getExistingNeighbours,
  matchesTerrain,
} from "../world/neighbours";
import { isBoundaryTile } from "../world/tileCreation";
import {
  formatSelection,
  getPrimarySelectedTileId,
} from "../selection/selection";
import { formatProposalMessage } from "../rules/engine";
import { canCommitProposal } from "../rules/proposeCardPlay";
import {
  formatInstanceLabel,
  getActiveInstance,
  getCardDefinition,
  getDeckSummary,
} from "../deck/deckQueries";
import {
  describePropagationDefinition,
  describePropagationResult,
} from "../rules/propagation/describe";
import { describeResolvedTargets } from "../rules/targeting/describe";
import { findRegionForTileAtTier } from "../worldLaws/settlementHierarchy";
import { findRuinClusterForTile } from "../worldLaws/ruinClusters";
import { cards } from "../cards/cardDefinitions";
import { formatEndpointLabel } from "../networks/endpoints";
import { getRoute, getRoutesThroughTile } from "../networks/networkQueries";
import {
  formatSettlementSummary,
  getSettlementSummary,
} from "../worldLaws/settlementSummary";
import {
  formatDeckCatalogueForWorld,
  type CatalogueFilter,
} from "./cardCatalogue";
import {
  DEV_VISUAL_CONTROL_OPTIONS,
  getDevVisualControls,
  setDevVisualControl,
} from "../visuals/devVisualControls";
import { buildPreviewLegendEntries } from "../visuals/renderers/mapVisualRenderer";
import { getMapTheme } from "../visuals/themeManager";
import {
  getConsequencePreviewTileIds,
  getPreviewTileIds,
  getPropagationAffectedTileIds,
  getPropagationBlockedTileIds,
  getPropagationCreatedTileIds,
} from "../rules/engine";

export type AppState = {
  world: WorldState | null;
  selection: SelectionState;
  drawnCard: CardDefinition | null;
  proposedAction: ProposedAction | null;
  selectedRouteId: string | null;
  statusMessage: string;
  loadError: string | null;
};

export type SidebarElements = {
  selectedLocation: HTMLParagraphElement;
  worldSummary: HTMLPreElement;
  statusMessage: HTMLParagraphElement;
  recoveryPanel: HTMLElement;
  createNewWorldButton: HTMLButtonElement;
  selectionModeInputs: NodeListOf<HTMLInputElement>;
  drawCardButton: HTMLButtonElement;
  devExpandTileButton: HTMLButtonElement;
  devScenarioSelect: HTMLSelectElement;
  devLoadScenarioButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  cardPanel: HTMLElement;
  cardName: HTMLHeadingElement;
  cardDescription: HTMLParagraphElement;
  cardValidation: HTMLParagraphElement;
  applyCardButton: HTMLButtonElement;
  discardCardButton: HTMLButtonElement;
  deckSummary: HTMLPreElement;
  catalogueFilter: HTMLSelectElement;
  catalogueContent: HTMLPreElement;
  devInspectionCardinal: HTMLParagraphElement;
  devInspectionAll: HTMLParagraphElement;
  devInspectionRegion: HTMLParagraphElement;
  devInspectionSettlement: HTMLParagraphElement;
  devInspectionSettlementDetail: HTMLPreElement;
  devInspectionRouteDetail: HTMLPreElement;
  devInspectionTargeting: HTMLPreElement;
  devInspectionPropagation: HTMLPreElement;
  devInspectionDeck: HTMLPreElement;
  devVisualControls: HTMLFieldSetElement;
  previewLegend: HTMLElement;
  previewLegendList: HTMLUListElement;
};

export function getSidebarElements(): SidebarElements {
  const selectedLocation = document.querySelector<HTMLParagraphElement>(
    "#selected-location",
  );
  const worldSummary = document.querySelector<HTMLPreElement>("#world-summary");
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
  const devScenarioSelect =
    document.querySelector<HTMLSelectElement>("#dev-scenario-select");
  const devLoadScenarioButton = document.querySelector<HTMLButtonElement>(
    "#dev-load-scenario",
  );
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
  const deckSummary = document.querySelector<HTMLPreElement>("#deck-summary");
  const catalogueFilter =
    document.querySelector<HTMLSelectElement>("#catalogue-filter");
  const catalogueContent =
    document.querySelector<HTMLPreElement>("#catalogue-content");
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
  const devInspectionSettlementDetail = document.querySelector<HTMLPreElement>(
    "#dev-inspection-settlement-detail",
  );
  const devInspectionRouteDetail = document.querySelector<HTMLPreElement>(
    "#dev-inspection-route-detail",
  );
  const devInspectionTargeting = document.querySelector<HTMLPreElement>(
    "#dev-inspection-targeting",
  );
  const devInspectionPropagation = document.querySelector<HTMLPreElement>(
    "#dev-inspection-propagation",
  );
  const devInspectionDeck = document.querySelector<HTMLPreElement>(
    "#dev-inspection-deck",
  );
  const devVisualControls = document.querySelector<HTMLFieldSetElement>(
    "#dev-visual-controls",
  );
  const previewLegend = document.querySelector<HTMLElement>("#preview-legend");
  const previewLegendList = document.querySelector<HTMLUListElement>(
    "#preview-legend-list",
  );

  if (
    !selectedLocation ||
    !worldSummary ||
    !statusMessage ||
    !recoveryPanel ||
    !createNewWorldButton ||
    selectionModeInputs.length === 0 ||
    !drawCardButton ||
    !devExpandTileButton ||
    !devScenarioSelect ||
    !devLoadScenarioButton ||
    !exportButton ||
    !importButton ||
    !importInput ||
    !cardPanel ||
    !cardName ||
    !cardDescription ||
    !cardValidation ||
    !applyCardButton ||
    !discardCardButton ||
    !deckSummary ||
    !catalogueFilter ||
    !catalogueContent ||
    !devInspectionCardinal ||
    !devInspectionAll ||
    !devInspectionRegion ||
    !devInspectionSettlement ||
    !devInspectionSettlementDetail ||
    !devInspectionRouteDetail ||
    !devInspectionTargeting ||
    !devInspectionPropagation ||
    !devInspectionDeck ||
    !devVisualControls ||
    !previewLegend ||
    !previewLegendList
  ) {
    throw new Error("Sidebar elements are missing from the page.");
  }

  return {
    selectedLocation,
    worldSummary,
    statusMessage,
    recoveryPanel,
    createNewWorldButton,
    selectionModeInputs,
    drawCardButton,
    devExpandTileButton,
    devScenarioSelect,
    devLoadScenarioButton,
    exportButton,
    importButton,
    importInput,
    cardPanel,
    cardName,
    cardDescription,
    cardValidation,
    applyCardButton,
    discardCardButton,
    deckSummary,
    catalogueFilter,
    catalogueContent,
    devInspectionCardinal,
    devInspectionAll,
    devInspectionRegion,
    devInspectionSettlement,
    devInspectionSettlementDetail,
    devInspectionRouteDetail,
    devInspectionTargeting,
    devInspectionPropagation,
    devInspectionDeck,
    devVisualControls,
    previewLegend,
    previewLegendList,
  };
}

export function wireDevVisualControls(
  elements: SidebarElements,
  onChange: () => void,
): void {
  if (!import.meta.env.DEV) {
    elements.devVisualControls.hidden = true;
    return;
  }

  if (elements.devVisualControls.dataset.wired === "true") {
    return;
  }

  elements.devVisualControls.dataset.wired = "true";
  const controls = getDevVisualControls();

  for (const option of DEV_VISUAL_CONTROL_OPTIONS) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = controls[option.key];
    input.addEventListener("change", () => {
      setDevVisualControl(option.key, input.checked);
      onChange();
    });
    label.append(input, document.createTextNode(option.label));
    elements.devVisualControls.append(label);
  }
}

function formatRegionLine(
  label: string,
  regionId: string | undefined,
): string {
  return `${label}: ${regionId ?? "none"}`;
}

function formatSettlementInspection(
  world: WorldState,
  tileId: string,
): string {
  const tile = world.tiles[tileId];

  if (!tile?.settlement) {
    return "";
  }

  if (isVillageSettlement(tile.settlement)) {
    return [
      "Settlement: Village",
      `Inhospitable turns: ${tile.settlement.inhospitableTurns} / 3`,
      formatRegionLine(
        "Town region",
        findRegionForTileAtTier(world.settlementRegions, tileId, "town")?.id,
      ),
      formatRegionLine(
        "Expanse region",
        findRegionForTileAtTier(world.settlementRegions, tileId, "expanse")?.id,
      ),
      formatRegionLine(
        "Urban region",
        findRegionForTileAtTier(world.settlementRegions, tileId, "urban-region")
          ?.id,
      ),
      formatRegionLine(
        "Quadrant region",
        findRegionForTileAtTier(world.settlementRegions, tileId, "quadrant")?.id,
      ),
      formatRegionLine(
        "Sunder region",
        findRegionForTileAtTier(world.settlementRegions, tileId, "sunder")?.id,
      ),
      "Ruin cluster: none",
    ].join("\n");
  }

  if (isRuinSettlement(tile.settlement)) {
    const cluster = findRuinClusterForTile(world, tileId);

    return [
      "Settlement: Ruin",
      `Ruined on turn: ${tile.settlement.ruinedAtTurn}`,
      `Ruin group size: ${cluster.length || 1}`,
    ].join("\n");
  }

  return "";
}

function formatRouteInspection(
  world: WorldState,
  routeId: string,
): string {
  const route = getRoute(world, routeId);

  if (!route) {
    return "";
  }

  const cardName =
    cards.find((card) => card.id === route.createdByCardId)?.name ??
    route.createdByCardId;
  const totalCost = route.properties.totalCost;

  return [
    `Type: ${route.type.charAt(0).toUpperCase()}${route.type.slice(1)}`,
    `Created on turn: ${route.createdTurn}`,
    `Origin: ${formatEndpointLabel(world, route.origin)}`,
    `Destination: ${formatEndpointLabel(world, route.destination)}`,
    `Length: ${route.pathTileIds.length} tiles`,
    `Travel cost: ${typeof totalCost === "number" ? totalCost : "—"}`,
    `Created by: ${cardName}`,
  ].join("\n");
}

function formatTileRouteInspection(world: WorldState, tileId: string): string {
  const routes = getRoutesThroughTile(world, tileId);

  if (routes.length === 0) {
    return "Routes through this tile: 0";
  }

  return [
    `Routes through this tile: ${routes.length}`,
    `Road IDs: ${routes.map((route) => route.id).join(", ")}`,
  ].join("\n");
}

function formatTargetingInspection(
  proposal: ProposedAction | null,
): string {
  if (!proposal?.targetResolution) {
    return "";
  }

  const lines = [
    ...describeResolvedTargets(proposal.targetResolution),
    `Random seed: ${proposal.randomSeed}`,
  ];

  const resolvedEntries = Object.entries(proposal.targetResolution.resolvedValues);

  if (resolvedEntries.length > 0) {
    lines.push(
      "Resolved values:",
      ...resolvedEntries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
    );
  }

  return lines.join("\n");
}

function formatPropagationInspection(
  proposal: ProposedAction | null,
): string {
  if (!proposal || proposal.propagationResults.length === 0) {
    return "";
  }

  const lines: string[] = [];

  proposal.propagationResults.forEach((result, index) => {
    const effect = proposal.cardId
      ? cards.find((card) => card.id === proposal.cardId)?.effects[index]
      : undefined;

    if (effect?.type === "propagate") {
      lines.push(`Strategy:\n${describePropagationDefinition(effect)}`);
    }

    lines.push(
      `Magnitude:\n${result.resolvedValues["propagation.magnitude"] ?? "—"} affected tiles`,
    );

    if (result.seedTileIds[0]) {
      lines.push(`Seed:\n${result.seedTileIds[0]}`);
    }

    result.steps.forEach((step) => {
      const label = `${step.toCoordinate.x},${step.toCoordinate.y}`;
      const status = step.applied
        ? "Applied"
        : step.skippedReason ?? "Skipped";

      lines.push(
        `Step ${step.sequence + 1}:\n${label}\nCost ${step.traversalCost}\n${status}`,
      );
    });

    if (result.createdTileIds.length > 0) {
      lines.push(`Created tiles:\n${result.createdTileIds.join(", ")}`);
    }

    const replacementSkips = result.steps
      .filter((step) => !step.applied && step.skippedReason?.includes("priority"))
      .map(
        (step) =>
          `Replacement skip at ${step.toCoordinate.x},${step.toCoordinate.y}: ${step.skippedReason}`,
      );

    if (replacementSkips.length > 0) {
      lines.push(`Replacement skips:\n${replacementSkips.join("\n")}`);
    }

    lines.push(...describePropagationResult(result));

    const resolvedEntries = Object.entries(result.resolvedValues);

    if (resolvedEntries.length > 0) {
      lines.push(
        "Resolved values:",
        ...resolvedEntries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
      );
    }
  });

  lines.push(`Random seed: ${proposal.randomSeed}`);

  return lines.join("\n\n");
}

function formatDeckSummary(world: WorldState): string {
  const summary = getDeckSummary(world.deck);
  const lines = [
    `Draw pile: ${summary.drawCount}`,
    `Discard pile: ${summary.discardCount}`,
    `Retired: ${summary.retiredCount}`,
    `Active: ${summary.activeName ?? "none"}`,
    `Shuffles: ${summary.shuffleCount}`,
  ];

  const active = getActiveInstance(world.deck);

  if (active) {
    const definition = getCardDefinition(active.definitionId);
    lines.push(
      "",
      "Active instance:",
      `Name: ${formatInstanceLabel(active, definition)}`,
      `Instance ID: ${active.instanceId}`,
      `Definition: ${active.definitionId}`,
      `Modifications: ${active.modifications.length}`,
      `Created turn: ${active.createdTurn}`,
      `Created by action: ${active.createdByActionId ?? "initial deck"}`,
      `Tags: ${active.tags.join(", ") || "none"}`,
      `Pile: active`,
    );
  }

  return lines.join("\n");
}

function formatDevDeckPiles(world: WorldState): string {
  const formatPile = (label: string, pile: typeof world.deck.drawPile) => {
    if (pile.length === 0) {
      return `${label}: empty`;
    }

    return [
      `${label}:`,
      ...pile.map((instance) => {
        const definition = getCardDefinition(instance.definitionId);
        return `- ${formatInstanceLabel(instance, definition)}`;
      }),
    ].join("\n");
  };

  return [
    formatPile("Draw pile cards", world.deck.drawPile),
    formatPile("Discard pile cards", world.deck.discardPile),
    formatPile("Retired pile cards", world.deck.retiredPile),
  ].join("\n\n");
}

function formatFailureInspection(proposal: ProposedAction | null): string {
  if (!proposal?.failureResolution) {
    return "";
  }

  const lines = ["Failure resolution:"];

  for (const attempt of proposal.failureResolution.attempts) {
    lines.push(
      `Attempt ${attempt.attempt}: ${attempt.behaviourType} → ${attempt.result}`,
      ...attempt.messages.map((message) => `  ${message}`),
    );
  }

  return lines.join("\n");
}

function formatDeckChangeInspection(proposal: ProposedAction | null): string {
  if (!proposal?.deckChange) {
    return "";
  }

  const lines = ["Deck changes:"];

  for (const mutation of proposal.deckChange.mutations) {
    lines.push(`- ${mutation.type}`);
  }

  return lines.join("\n");
}

export function renderSidebar(
  elements: SidebarElements,
  state: AppState,
): void {
  const interactionsDisabled = state.world === null;
  const proposalMessage = state.proposedAction
    ? formatProposalMessage(state.proposedAction)
    : "";
  const canApply = state.proposedAction
    ? canCommitProposal(state.proposedAction)
    : false;

  elements.selectedLocation.textContent = state.world
    ? formatSelection(state.world, state.selection)
    : "Map unavailable";
  elements.worldSummary.textContent = state.world
    ? formatSettlementSummary(getSettlementSummary(state.world))
    : "";
  elements.deckSummary.textContent = state.world
    ? formatDeckSummary(state.world)
    : "";
  elements.catalogueContent.textContent = state.world
    ? formatDeckCatalogueForWorld(
        state.world.deckConfigurationId,
        elements.catalogueFilter.value as CatalogueFilter,
      )
    : "";
  elements.devInspectionDeck.textContent =
    import.meta.env.DEV && state.world ? formatDevDeckPiles(state.world) : "";

  if (state.proposedAction) {
    const routeOrigin = new Set<string>();
    const routeDestination = new Set<string>();

    if (state.selection.routeOriginTileId) {
      routeOrigin.add(state.selection.routeOriginTileId);
    }

    if (state.selection.routeDestinationTileId) {
      routeDestination.add(state.selection.routeDestinationTileId);
    }

    const legendEntries = buildPreviewLegendEntries(
      {
        selected: new Set(state.selection.tileIds),
        preview: new Set(getPreviewTileIds(state.proposedAction)),
        consequencePreview: new Set(
          getConsequencePreviewTileIds(state.proposedAction),
        ),
        routeOrigin,
        routeDestination,
        propagation:
          state.proposedAction.propagationResults.length > 0
            ? {
                showFullPath: false,
                seed: new Set(),
                affected: new Set(
                  getPropagationAffectedTileIds(state.proposedAction),
                ),
                created: new Set(
                  getPropagationCreatedTileIds(state.proposedAction),
                ),
                traversed: new Set(),
                blocked: new Set(
                  getPropagationBlockedTileIds(state.proposedAction),
                ),
              }
            : undefined,
      },
      getMapTheme(),
    );

    if (legendEntries.length > 0) {
      elements.previewLegend.hidden = false;
      elements.previewLegendList.replaceChildren(
        ...legendEntries.map((entry) => {
          const item = document.createElement("li");
          item.textContent = entry;
          return item;
        }),
      );
    } else {
      elements.previewLegend.hidden = true;
      elements.previewLegendList.replaceChildren();
    }
  } else {
    elements.previewLegend.hidden = true;
    elements.previewLegendList.replaceChildren();
  }
  elements.statusMessage.textContent = state.loadError ?? state.statusMessage;
  elements.statusMessage.dataset.error = state.loadError ? "true" : "false";
  elements.recoveryPanel.hidden = state.loadError === null;

  elements.drawCardButton.disabled =
    interactionsDisabled || Boolean(state.world?.deck.activeInstanceId);
  elements.discardCardButton.disabled =
    interactionsDisabled || !state.drawnCard;
  elements.exportButton.disabled = interactionsDisabled;
  elements.importButton.disabled = interactionsDisabled;
  elements.devScenarioSelect.disabled = interactionsDisabled;
  elements.devLoadScenarioButton.disabled = interactionsDisabled;

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
    const settlementCount = selectedTile.settlement ? 1 : 0;

    elements.devInspectionCardinal.textContent = `Cardinal neighbours: ${cardinalCount}`;
    elements.devInspectionAll.textContent = `All neighbours: ${allCount}`;
    elements.devInspectionRegion.textContent = `Connected terrain region: ${regionCount}`;
    elements.devInspectionSettlement.textContent = `Settlement present: ${settlementCount > 0 ? "yes" : "no"}`;
    elements.devInspectionSettlementDetail.textContent = formatSettlementInspection(
      state.world,
      selectedTileId,
    );
    elements.devInspectionRouteDetail.textContent = [
      formatTileRouteInspection(state.world, selectedTileId),
      state.selectedRouteId
        ? formatRouteInspection(state.world, state.selectedRouteId)
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    elements.devInspectionTargeting.textContent = formatTargetingInspection(
      state.proposedAction,
    );
    elements.devInspectionPropagation.textContent = formatPropagationInspection(
      state.proposedAction,
    );
  } else {
    elements.devInspectionCardinal.textContent = "Cardinal neighbours: —";
    elements.devInspectionAll.textContent = "All neighbours: —";
    elements.devInspectionRegion.textContent = "Connected terrain region: —";
    elements.devInspectionSettlement.textContent = "Settlement present: —";
    elements.devInspectionSettlementDetail.textContent = "";
    elements.devInspectionRouteDetail.textContent = state.world && state.selectedRouteId
      ? formatRouteInspection(state.world, state.selectedRouteId)
      : "";
    elements.devInspectionTargeting.textContent = formatTargetingInspection(
      state.proposedAction,
    );
    elements.devInspectionPropagation.textContent = formatPropagationInspection(
      state.proposedAction,
    );
  }

  for (const input of elements.selectionModeInputs) {
    input.checked = input.value === state.selection.mode;
    input.disabled = interactionsDisabled;
  }

  if (state.drawnCard && state.world) {
    elements.cardPanel.hidden = false;
    elements.cardName.textContent = state.drawnCard.name;
    elements.cardDescription.textContent = state.drawnCard.description;

    const active = getActiveInstance(state.world.deck);
    const baseDefinition = active
      ? getCardDefinition(active.definitionId)
      : undefined;
    const modificationLines =
      active && active.modifications.length > 0
        ? [
            "",
            `Base: ${baseDefinition?.name ?? active.definitionId}`,
            ...active.modifications.map(
              (modification) => `Modification: ${modification.type}`,
            ),
            `Effective: ${state.drawnCard.name}`,
          ]
        : [];

    const extraLines = [
      ...modificationLines,
      formatFailureInspection(state.proposedAction),
      formatDeckChangeInspection(state.proposedAction),
    ].filter(Boolean);

    elements.cardValidation.textContent = [proposalMessage, ...extraLines]
      .filter(Boolean)
      .join("\n\n");
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
    return `Loaded saved world. Turn ${world.turn}.`;
  }

  return `Loaded saved world. Turn ${world.turn}. Latest action #${latestAction}.`;
}

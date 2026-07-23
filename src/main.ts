import "leaflet/dist/leaflet.css";
import "./style.css";

import { cardRequiresTwoEndpoints } from "./cards/cardTypes";
import {
  createWorldMap,
  renderWorldMap,
  fitMapToWorld,
  updateMapBounds,
  type WorldMapView,
} from "./map/createMap";
import type { TileHighlightState } from "./map/tileLayer";
import {
  exportWorldToFile,
  importWorldFromFile,
} from "./persistence/worldExport";
import {
  clearSavedWorld,
  loadWorld,
  saveWorld,
} from "./persistence/worldStorage";
import {
  getConsequencePreviewTileIds,
  getPreviewTileIds,
  getPropagationBlockedTileIds,
  getPropagationCreatedTileIds,
  getPropagationAffectedTileIds,
  getPropagationSeedTileIds,
  getPropagationTraversedTileIds,
} from "./rules/engine";
import {
  proposeCardPlay,
  resolveEffectiveCardForActiveInstance,
} from "./rules/proposeCardPlay";
import { createRandomSeed } from "./rules/random";
import {
  handleTileSelection,
  setSelectionMode,
} from "./selection/selection";
import {
  createEmptySelection,
  type SelectionMode,
} from "./selection/selectionTypes";
import {
  formatLoadedWorldMessage,
  getSidebarElements,
  renderSidebar,
  type AppState,
} from "./ui/sidebar";
import {
  commitDiscardActiveCard,
  commitDrawCard,
} from "./world/commitDeckAction";
import { commitWorldAction } from "./world/commitWorldAction";
import { commitTileCreation } from "./world/commitTileCreation";
import {
  createDevScenario,
  type DevScenarioId,
} from "./dev/devScenarios";
import {
  getFirstMissingCardinalNeighbour,
  isBoundaryTile,
} from "./world/tileCreation";
import { createStarterWorld } from "./world/worldState";
import type { WorldState } from "./world/worldTypes";

type StartupResult = {
  world: WorldState | null;
  statusMessage: string;
  loadError: string | null;
};

function createAndSaveNewWorld(): WorldState {
  clearSavedWorld();

  const world = createStarterWorld("Untitled World");
  saveWorld(world);

  return world;
}

function initializeWorld(): StartupResult {
  try {
    const savedWorld = loadWorld();

    if (savedWorld) {
      return {
        world: savedWorld,
        statusMessage: formatLoadedWorldMessage(savedWorld),
        loadError: null,
      };
    }

    const world = createAndSaveNewWorld();

    return {
      world,
      statusMessage: "New world created and saved.",
      loadError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The saved world could not be loaded.";

    return {
      world: null,
      statusMessage: "",
      loadError: message,
    };
  }
}

function createInitialState(startup: StartupResult): AppState {
  const drawnCard = startup.world
    ? resolveEffectiveCardForActiveInstance(startup.world)?.card ?? null
    : null;

  return {
    world: startup.world,
    selection: createEmptySelection("single"),
    drawnCard,
    proposedAction: null,
    selectedRouteId: null,
    statusMessage: startup.statusMessage,
    loadError: startup.loadError,
  };
}

function buildProposal(state: AppState) {
  if (!state.drawnCard || !state.world) {
    return null;
  }

  return proposeCardPlay(
    state.world,
    state.selection.tileIds,
    state.proposedAction?.randomSeed ?? createRandomSeed(),
    state.selection,
  );
}

function getTileHighlights(state: AppState): TileHighlightState {
  const routeOrigin = new Set<string>();
  const routeDestination = new Set<string>();

  if (state.selection.routeOriginTileId) {
    routeOrigin.add(state.selection.routeOriginTileId);
  }

  if (state.selection.routeDestinationTileId) {
    routeDestination.add(state.selection.routeDestinationTileId);
  }

  const resolution = state.proposedAction?.targetResolution;
  const showPipeline = import.meta.env.DEV;
  const propagationProposal = state.proposedAction;
  const candidateIds = resolution?.candidateIds ?? [];
  const filteredIds = resolution?.filteredCandidateIds ?? [];
  const filteredOut = showPipeline
    ? candidateIds.filter((tileId) => !filteredIds.includes(tileId))
    : [];

  return {
    selected: new Set(state.selection.tileIds),
    preview: new Set(
      state.proposedAction ? getPreviewTileIds(state.proposedAction) : [],
    ),
    consequencePreview: new Set(
      state.proposedAction
        ? getConsequencePreviewTileIds(state.proposedAction)
        : [],
    ),
    routeOrigin,
    routeDestination,
    targeting: resolution
      ? {
          showPipeline,
          origin: new Set(resolution.originIds),
          candidates: new Set(showPipeline ? candidateIds : []),
          filteredOut: new Set(filteredOut),
          selected: new Set(resolution.selectedIds),
          expanded: new Set(resolution.expandedTargetIds),
        }
      : undefined,
    propagation:
      propagationProposal && propagationProposal.propagationResults.length > 0
        ? {
            showFullPath: showPipeline,
            seed: new Set(getPropagationSeedTileIds(propagationProposal)),
            affected: new Set(getPropagationAffectedTileIds(propagationProposal)),
            created: new Set(getPropagationCreatedTileIds(propagationProposal)),
            traversed: new Set(
              getPropagationTraversedTileIds(propagationProposal),
            ),
            blocked: new Set(getPropagationBlockedTileIds(propagationProposal)),
          }
        : undefined,
  };
}

function getDisplayWorld(state: AppState): WorldState | null {
  if (!state.world) {
    return null;
  }

  if (state.proposedAction?.valid && state.proposedAction.resultingWorld) {
    return state.proposedAction.resultingWorld;
  }

  return state.world;
}

function bootstrap(): void {
  const sidebar = getSidebarElements();
  const startup = initializeWorld();
  let state = createInitialState(startup);
  let worldMap: WorldMapView | null = null;

  function onTileSelect(tileId: string): void {
    if (!state.world) {
      return;
    }

    state = {
      ...state,
      selection: handleTileSelection(state.world, state.selection, tileId),
      proposedAction: null,
      selectedRouteId: null,
    };
    state.proposedAction = buildProposal(state);
    refresh();
  }

  function onRouteSelect(routeId: string): void {
    state = {
      ...state,
      selectedRouteId: routeId,
      statusMessage: `Selected route ${routeId}.`,
    };
    refresh();
  }

  function mountWorldMap(world: WorldState): void {
    worldMap = createWorldMap(
      "map",
      world,
      getTileHighlights(state),
      onTileSelect,
      onRouteSelect,
    );
  }

  if (state.world) {
    mountWorldMap(state.world);
  }

  function refresh(options?: { fitMap?: boolean }): void {
    const displayWorld = getDisplayWorld(state);

    if (worldMap && displayWorld && state.world) {
      if (options?.fitMap) {
        fitMapToWorld(worldMap.map, displayWorld);
      } else {
        updateMapBounds(worldMap.map, displayWorld);
      }

      renderWorldMap(
        worldMap,
        displayWorld,
        getTileHighlights(state),
        onTileSelect,
        onRouteSelect,
        state.proposedAction?.proposedRoutes[0]?.route ?? null,
      );
    }

    renderSidebar(sidebar, state);
  }

  sidebar.createNewWorldButton.addEventListener("click", () => {
    try {
      const world = createAndSaveNewWorld();
      const hadMap = Boolean(worldMap);

      if (!worldMap) {
        mountWorldMap(world);
      }

      state = {
        world,
        selection: createEmptySelection("single"),
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: "New world created and saved.",
        loadError: null,
      };

      refresh({ fitMap: hadMap });
      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The new world could not be saved.";
      state = {
        ...state,
        loadError: message,
      };
    }

    refresh();
  });

  for (const input of sidebar.selectionModeInputs) {
    input.addEventListener("change", () => {
      if (!input.checked || !state.world) {
        return;
      }

      state = {
        ...state,
        selection: setSelectionMode(
          state.selection,
          input.value as SelectionMode,
        ),
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: `Selection mode: ${input.labels?.[0]?.textContent?.trim() ?? input.value}.`,
      };
      state.proposedAction = buildProposal(state);
      refresh();
    });
  }

  sidebar.drawCardButton.addEventListener("click", () => {
    if (!state.world) {
      return;
    }

    if (state.world.deck.activeInstanceId) {
      state = {
        ...state,
        statusMessage: "Discard or play the active card before drawing another.",
      };
      refresh();
      return;
    }

    try {
      const drawResult = commitDrawCard(state.world);
      const active = resolveEffectiveCardForActiveInstance(drawResult.world);

      if (!active) {
        throw new Error("The drawn card could not be resolved.");
      }

      const selectionMode = cardRequiresTwoEndpoints(active.card)
        ? "two-endpoints"
        : state.selection.mode;

      state = {
        ...state,
        world: drawResult.world,
        drawnCard: active.card,
        selection: createEmptySelection(selectionMode),
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: cardRequiresTwoEndpoints(active.card)
          ? `Drew "${active.card.name}". Select a route origin, then a destination.`
          : drawResult.message,
        loadError: null,
      };
      state.proposedAction = buildProposal(state);
      refresh();
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The card could not be drawn.";
      state = { ...state, statusMessage: message };
    }

    refresh();
  });

  sidebar.drawRoadCardButton.addEventListener("click", () => {
    if (!state.world) {
      return;
    }

    if (state.world.deck.activeInstanceId) {
      state = {
        ...state,
        statusMessage: "Discard or play the active card before drawing another.",
      };
      refresh();
      return;
    }

    try {
      const drawResult = commitDrawCard(state.world);
      const active = resolveEffectiveCardForActiveInstance(drawResult.world);

      if (!active) {
        throw new Error("The drawn card could not be resolved.");
      }

      state = {
        ...state,
        world: drawResult.world,
        drawnCard: active.card,
        selection: createEmptySelection("two-endpoints"),
        proposedAction: null,
        selectedRouteId: null,
        statusMessage:
          active.card.id === "the-road-between"
            ? `Drew "${active.card.name}". Select a route origin, then a destination.`
            : `Drew "${active.card.name}" instead of The Road Between. Discard to draw again.`,
        loadError: null,
      };
      state.proposedAction = buildProposal(state);
      refresh();
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The road card could not be drawn.";
      state = { ...state, statusMessage: message };
    }

    refresh();
  });

  sidebar.applyCardButton.addEventListener("click", () => {
    if (!state.drawnCard || !state.world || !state.proposedAction) {
      return;
    }

    try {
      const result = commitWorldAction(
        state.world,
        state.drawnCard,
        state.selection.tileIds,
        state.proposedAction.randomSeed,
        state.proposedAction,
        state.selection,
      );

      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: result.message,
        loadError: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The action could not be saved. The world was not changed.";
      state = { ...state, statusMessage: message };
    }

    refresh();
  });

  sidebar.discardCardButton.addEventListener("click", () => {
    if (!state.world || !state.drawnCard) {
      return;
    }

    const discardedName = state.drawnCard.name;

    try {
      const result = commitDiscardActiveCard(state.world);
      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: `Discarded "${discardedName}".`,
        loadError: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The card could not be discarded.";
      state = { ...state, statusMessage: message };
    }

    refresh();
  });

  if (import.meta.env.DEV) {
    sidebar.devLoadScenarioButton.addEventListener("click", () => {
      try {
        const scenarioId = sidebar.devScenarioSelect.value as DevScenarioId;
        const world = createDevScenario(scenarioId);
        saveWorld(world);
        const hadMap = Boolean(worldMap);

        if (!worldMap) {
          mountWorldMap(world);
        }

        state = {
          world,
          selection: createEmptySelection("single"),
          drawnCard: null,
          proposedAction: null,
          selectedRouteId: null,
          statusMessage: `Loaded dev scenario "${scenarioId}".`,
          loadError: null,
        };

        refresh({ fitMap: hadMap });
        return;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The dev scenario could not be loaded.";
        state = { ...state, statusMessage: message };
      }

      refresh();
    });
  } else {
    sidebar.devScenarioSelect.hidden = true;
    sidebar.devLoadScenarioButton.hidden = true;
  }

  sidebar.devExpandTileButton.addEventListener("click", () => {
    if (!state.world) {
      return;
    }

    const selectedTileId = state.selection.tileIds[0];

    if (!selectedTileId || !isBoundaryTile(state.world, selectedTileId)) {
      state = {
        ...state,
        statusMessage: "Select a boundary tile with open space beside it.",
      };
      refresh();
      return;
    }

    const coordinate = getFirstMissingCardinalNeighbour(
      state.world,
      selectedTileId,
    );

    if (!coordinate) {
      state = {
        ...state,
        statusMessage: "No missing cardinal neighbour was found.",
      };
      refresh();
      return;
    }

    try {
      const result = commitTileCreation(state.world, coordinate, "empty");

      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: result.message,
        loadError: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The action could not be saved. The world was not changed.";
      state = { ...state, statusMessage: message };
    }

    refresh();
  });

  sidebar.exportButton.addEventListener("click", () => {
    if (!state.world) {
      return;
    }

    exportWorldToFile(state.world);
    state = {
      ...state,
      statusMessage: `Exported "${state.world.name}".`,
    };
    refresh();
  });

  sidebar.importButton.addEventListener("click", () => {
    sidebar.importInput.click();
  });

  sidebar.importInput.addEventListener("change", async () => {
    const file = sidebar.importInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      const importedWorld = await importWorldFromFile(file);
      saveWorld(importedWorld);
      const hadMap = Boolean(worldMap);

      state = {
        world: importedWorld,
        selection: createEmptySelection(state.selection.mode),
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: `Imported "${importedWorld.name}".`,
        loadError: null,
      };

      if (!worldMap && state.world) {
        mountWorldMap(state.world);
      }

      sidebar.importInput.value = "";
      refresh({ fitMap: hadMap });
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The world could not be imported.";
      state = { ...state, statusMessage: message };
    }

    sidebar.importInput.value = "";
    refresh();
  });

  refresh();
}

bootstrap();

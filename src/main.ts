import "leaflet/dist/leaflet.css";
import "./style.css";

import { drawRandomCard } from "./cards/drawCard";
import {
  createWorldMap,
  renderWorldTiles,
  syncMapViewport,
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
  getPreviewTileIds,
  proposeAction,
} from "./rules/engine";
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
import { commitWorldAction } from "./world/commitWorldAction";
import { commitTileCreation } from "./world/commitTileCreation";
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
  return {
    world: startup.world,
    selection: createEmptySelection("single"),
    drawnCard: null,
    proposedAction: null,
    statusMessage: startup.statusMessage,
    loadError: startup.loadError,
  };
}

function buildProposal(state: AppState) {
  if (!state.drawnCard || !state.world) {
    return null;
  }

  return proposeAction(
    state.world,
    state.drawnCard,
    state.selection.tileIds,
    state.proposedAction?.randomSeed ?? createRandomSeed(),
  );
}

function getTileHighlights(state: AppState): TileHighlightState {
  return {
    selected: new Set(state.selection.tileIds),
    preview: new Set(
      state.proposedAction ? getPreviewTileIds(state.proposedAction) : [],
    ),
  };
}

function bootstrap(): void {
  const sidebar = getSidebarElements();
  const startup = initializeWorld();
  let state = createInitialState(startup);
  let worldMap: WorldMapView | null = null;

  function mountWorldMap(world: WorldState): void {
    worldMap = createWorldMap(
      "map",
      world,
      getTileHighlights(state),
      (tileId) => {
        if (!state.world) {
          return;
        }

        state = {
          ...state,
          selection: handleTileSelection(state.world, state.selection, tileId),
          proposedAction: null,
        };
        state.proposedAction = buildProposal(state);
        refresh();
      },
    );
  }

  if (state.world) {
    mountWorldMap(state.world);
  }

  function refresh(): void {
    if (worldMap && state.world) {
      syncMapViewport(worldMap.map, state.world);

      renderWorldTiles(
        worldMap.tileLayerGroup,
        state.world,
        getTileHighlights(state),
        (tileId) => {
          if (!state.world) {
            return;
          }

          state = {
            ...state,
            selection: handleTileSelection(state.world, state.selection, tileId),
            proposedAction: null,
          };
          state.proposedAction = buildProposal(state);
          refresh();
        },
      );
    }

    renderSidebar(sidebar, state);
  }

  sidebar.createNewWorldButton.addEventListener("click", () => {
    try {
      const world = createAndSaveNewWorld();

      if (!worldMap) {
        mountWorldMap(world);
      }

      state = {
        world,
        selection: createEmptySelection("single"),
        drawnCard: null,
        proposedAction: null,
        statusMessage: "New world created and saved.",
        loadError: null,
      };
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

    const drawnCard = drawRandomCard();
    state = {
      ...state,
      drawnCard,
      proposedAction: null,
      statusMessage: `Drew "${drawnCard.name}".`,
    };
    state.proposedAction = buildProposal(state);
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
      );

      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
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
    if (!state.drawnCard) {
      return;
    }

    const discardedName = state.drawnCard.name;
    state = {
      ...state,
      drawnCard: null,
      proposedAction: null,
      statusMessage: `Discarded "${discardedName}".`,
    };
    refresh();
  });

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

      state = {
        world: importedWorld,
        selection: createEmptySelection(state.selection.mode),
        drawnCard: null,
        proposedAction: null,
        statusMessage: `Imported "${importedWorld.name}".`,
        loadError: null,
      };

      if (!worldMap && state.world) {
        mountWorldMap(state.world);
      }
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

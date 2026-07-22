import "leaflet/dist/leaflet.css";
import "./style.css";

import { drawRandomCard } from "./cards/drawCard";
import { validateCardApplication } from "./cards/validateCard";
import {
  createWorldMap,
  getDefaultWorldDimensions,
  renderWorldTiles,
  type WorldMapView,
} from "./map/createMap";
import {
  clearSavedWorld,
  loadWorld,
  saveWorld,
} from "./persistence/worldStorage";
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
import { createWorld } from "./world/worldState";
import type { WorldState } from "./world/worldTypes";

type StartupResult = {
  world: WorldState | null;
  statusMessage: string;
  loadError: string | null;
};

function createAndSaveNewWorld(): WorldState {
  clearSavedWorld();

  const { width, height } = getDefaultWorldDimensions();
  const world = createWorld("Untitled World", width, height);
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
    statusMessage: startup.statusMessage,
    loadError: startup.loadError,
  };
}

function getValidation(state: AppState) {
  if (!state.drawnCard || !state.world) {
    return { valid: false, message: "" };
  }

  return validateCardApplication(
    state.world,
    state.drawnCard,
    state.selection.tileIds,
  );
}

function getSelectedTileIds(state: AppState): ReadonlySet<string> {
  return new Set(state.selection.tileIds);
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
      getSelectedTileIds(state),
      (tileId) => {
        if (!state.world) {
          return;
        }

        state = {
          ...state,
          selection: handleTileSelection(state.world, state.selection, tileId),
        };
        refresh();
      },
    );
  }

  if (state.world) {
    mountWorldMap(state.world);
  }

  function refresh(): void {
    const validation = getValidation(state);

    if (worldMap && state.world) {
      renderWorldTiles(
        worldMap.tileLayerGroup,
        state.world,
        getSelectedTileIds(state),
        (tileId) => {
          if (!state.world) {
            return;
          }

          state = {
            ...state,
            selection: handleTileSelection(state.world, state.selection, tileId),
          };
          refresh();
        },
      );
    }

    renderSidebar(sidebar, state, validation.message, validation.valid);
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
        statusMessage: `Selection mode: ${input.labels?.[0]?.textContent?.trim() ?? input.value}.`,
      };
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
      statusMessage: `Drew "${drawnCard.name}".`,
    };
    refresh();
  });

  sidebar.applyCardButton.addEventListener("click", () => {
    if (!state.drawnCard || !state.world) {
      return;
    }

    try {
      const result = commitWorldAction(
        state.world,
        state.drawnCard,
        state.selection.tileIds,
      );

      state = {
        ...state,
        world: result.world,
        drawnCard: null,
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
      statusMessage: `Discarded "${discardedName}".`,
    };
    refresh();
  });

  refresh();
}

bootstrap();

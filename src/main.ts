import "leaflet/dist/leaflet.css";
import "./scss/main.scss";

import { cardRequiresTwoEndpoints } from "./cards/cardTypes";
import { loadEnvironment } from "./config/environment";
import { RepositoryConfigurationError } from "./persistence/repositoryErrors";
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
import { createWorldRepository } from "./persistence/repositoryFactory";
import {
  getWorldRepository,
  setActiveStoredRevision,
  setWorldRepository,
} from "./persistence/repositoryContext";
import { isRepositoryError } from "./persistence/repositoryErrors";
import type { WorldRepository } from "./persistence/worldRepository";
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
  createSelectionForCard,
} from "./selection/selection";
import { createEmptySelection } from "./selection/selectionTypes";
import { createSupabaseClient } from "./supabase/client";
import {
  formatAuthUserLabel,
  getAuthSessionState,
  onAuthStateChanged,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type AuthSessionState,
} from "./supabase/auth";
import { getCloudDiagnostics, formatCloudDiagnostics } from "./supabase/diagnostics";
import {
  formatLoadedWorldMessage,
  getSidebarElements,
  renderSidebar,
  wireDevVisualControls,
  type AppState,
} from "./ui/sidebar";
import {
  getInitialPersistenceStatus,
  resolveFailedStatus,
  resolveSavedStatus,
  resolveSavingStatus,
  type PersistenceStatus,
} from "./ui/persistenceStatus";
import type { AppEnvironment } from "./config/environmentTypes";
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
import { getDevVisualControls } from "./visuals/devVisualControls";
import { initializeMapTheme } from "./visuals/themeManager";

type StartupResult = {
  world: WorldState | null;
  statusMessage: string;
  loadError: string | null;
};

async function createAndSaveNewWorld(
  repository: WorldRepository,
): Promise<WorldState> {
  const world = createStarterWorld("Untitled World");
  const stored = await repository.createWorld(world);
  setActiveStoredRevision(stored.revision);
  return stored.world;
}

function isCloudPersistenceActive(
  environment: AppEnvironment,
  authState: AuthSessionState,
): boolean {
  return (
    environment.repositoryMode === "supabase" &&
    Boolean(authState.session && environment.supabase)
  );
}

async function refreshCloudDiagnostics(environment: AppEnvironment): Promise<string> {
  const diagnostics = await getCloudDiagnostics(environment);
  return formatCloudDiagnostics(environment, diagnostics);
}

async function initializeWorld(repository: WorldRepository): Promise<StartupResult> {
  try {
    const worlds = await repository.listWorlds();

    if (worlds.length > 0) {
      const summary = worlds[0]!;
      const stored = await repository.loadWorld(summary.id);

      if (stored) {
        setActiveStoredRevision(stored.revision);
        return {
          world: stored.world,
          statusMessage: formatLoadedWorldMessage(stored.world),
          loadError: null,
        };
      }
    }

    const world = await createAndSaveNewWorld(repository);

    return {
      world,
      statusMessage: "New world created and saved.",
      loadError: null,
    };
  } catch (error) {
    const message = isRepositoryError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "The saved world could not be loaded.";

    return {
      world: null,
      statusMessage: "",
      loadError: message,
    };
  }
}

function createInitialState(
  startup: StartupResult,
  persistenceStatus: PersistenceStatus,
  cloudDiagnosticsText: string,
  environment: AppEnvironment,
  authState: AuthSessionState,
): AppState {
  const cloudActive = isCloudPersistenceActive(environment, authState);

  const drawnCard = startup.world
    ? resolveEffectiveCardForActiveInstance(startup.world)?.card ?? null
    : null;

  return {
    world: startup.world,
    selection: createSelectionForCard(drawnCard),
    drawnCard,
    proposedAction: null,
    selectedRouteId: null,
    statusMessage: startup.statusMessage,
    loadError: startup.loadError,
    persistenceStatus,
    cloudDiagnosticsText,
    cloudAuthAvailable: Boolean(environment.supabase),
    authSignedIn: Boolean(authState.session),
    authUserLabel: formatAuthUserLabel(authState.user),
    authMessage: cloudActive
      ? "Cloud saves are active for this account."
      : environment.repositoryMode === "supabase"
        ? "Sign in to load and save worlds in the cloud."
        : "",
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
  const showPipeline = import.meta.env.DEV && getDevVisualControls().showPreviewPipeline;
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

async function bootstrap(): Promise<void> {
  initializeMapTheme();

  let environment: AppEnvironment;
  try {
    environment = loadEnvironment();
  } catch (error) {
    const message =
      error instanceof RepositoryConfigurationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The application configuration is invalid.";

    if (import.meta.env.PROD) {
      const app = document.getElementById("app");
      if (app) {
        app.innerHTML = `
          <section class="configuration-error">
            <h1>Configuration error</h1>
            <p>${message}</p>
          </section>
        `;
      }
      return;
    }

    throw error;
  }

  const supabaseClient = createSupabaseClient(environment);
  let authState = supabaseClient
    ? await getAuthSessionState(supabaseClient)
    : { session: null, user: null };

  function configureRepository(): void {
    setWorldRepository(
      createWorldRepository(environment, supabaseClient, {
        cloudEnabled: isCloudPersistenceActive(environment, authState),
      }),
    );
  }

  configureRepository();

  const cloudDiagnosticsText = await refreshCloudDiagnostics(environment);
  const sidebar = getSidebarElements();
  const startup = await initializeWorld(getWorldRepository());
  let state = createInitialState(
    startup,
    getInitialPersistenceStatus(environment, {
      cloudActive: isCloudPersistenceActive(environment, authState),
    }),
    cloudDiagnosticsText,
    environment,
    authState,
  );
  let worldMap: WorldMapView | null = null;
  const cloudActive = () => isCloudPersistenceActive(environment, authState);

  async function syncAuthState(nextAuthState: AuthSessionState): Promise<void> {
    authState = nextAuthState;
    configureRepository();
    const startupResult = await initializeWorld(getWorldRepository());

    state = {
      ...state,
      world: startupResult.world,
      drawnCard: startupResult.world
        ? resolveEffectiveCardForActiveInstance(startupResult.world)?.card ?? null
        : null,
      proposedAction: null,
      selectedRouteId: null,
      selection: createSelectionForCard(
        startupResult.world
          ? resolveEffectiveCardForActiveInstance(startupResult.world)?.card ??
              null
          : null,
      ),
      statusMessage: startupResult.statusMessage,
      loadError: startupResult.loadError,
      persistenceStatus: getInitialPersistenceStatus(environment, {
        cloudActive: isCloudPersistenceActive(environment, authState),
      }),
      cloudDiagnosticsText: await refreshCloudDiagnostics(environment),
      authSignedIn: Boolean(authState.session),
      authUserLabel: formatAuthUserLabel(authState.user),
      authMessage: isCloudPersistenceActive(environment, authState)
        ? "Cloud saves are active for this account."
        : environment.repositoryMode === "supabase"
          ? "Sign in to load and save worlds in the cloud."
          : "Signed out. Local saves remain available.",
    };

    if (startupResult.world && !worldMap) {
      mountWorldMap(startupResult.world);
    }

    refresh({ fitMap: Boolean(worldMap && startupResult.world) });
  }

  if (supabaseClient) {
    onAuthStateChanged(supabaseClient, (nextAuthState) => {
      void syncAuthState(nextAuthState);
    });
  }

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
      state.selection.tileIds,
    );

    worldMap.map.on("zoomend", () => {
      refresh();
    });
  }

  if (state.world) {
    mountWorldMap(state.world);
  }

  wireDevVisualControls(sidebar, () => refresh());

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
        state.selection.tileIds,
      );
    }

    renderSidebar(sidebar, state);
  }

  sidebar.createNewWorldButton.addEventListener("click", async () => {
    try {
      const worlds = await getWorldRepository().listWorlds();

      for (const summary of worlds) {
        await getWorldRepository().deleteWorld(summary.id);
      }

      const world = await createAndSaveNewWorld(getWorldRepository());
      const hadMap = Boolean(worldMap);

      if (!worldMap) {
        mountWorldMap(world);
      }

      state = {
        ...state,
        world,
        selection: createEmptySelection("single"),
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: "New world created and saved.",
        loadError: null,
        persistenceStatus: resolveSavedStatus(environment, cloudActive()),
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
        persistenceStatus: resolveFailedStatus(environment, error, cloudActive()),
      };
    }

    refresh();
  });

  sidebar.catalogueFilter.addEventListener("change", () => {
    refresh();
  });

  sidebar.drawCardButton.addEventListener("click", async () => {
    const currentWorld = state.world;
    if (!currentWorld) {
      return;
    }

    if (currentWorld.deck.activeInstanceId) {
      state = {
        ...state,
        statusMessage: "Discard or play the active card before drawing another.",
      };
      refresh();
      return;
    }

    state = { ...state, persistenceStatus: resolveSavingStatus(environment, cloudActive()) };
    refresh();

    try {
      const drawResult = await commitDrawCard(currentWorld);
      const active = resolveEffectiveCardForActiveInstance(drawResult.world);

      if (!active) {
        throw new Error("The drawn card could not be resolved.");
      }

      state = {
        ...state,
        world: drawResult.world,
        drawnCard: active.card,
        selection: createSelectionForCard(active.card),
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: cardRequiresTwoEndpoints(active.card)
          ? `Drew "${active.card.name}". Select a route origin, then a destination.`
          : drawResult.message,
        loadError: null,
        persistenceStatus: resolveSavedStatus(environment, cloudActive()),
      };
      state.proposedAction = buildProposal(state);
      refresh();
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The card could not be drawn.";
      state = { ...state, statusMessage: message, persistenceStatus: resolveFailedStatus(environment, error, cloudActive()) };
    }

    refresh();
  });

  sidebar.applyCardButton.addEventListener("click", async () => {
    const currentWorld = state.world;
    const drawnCard = state.drawnCard;
    const proposedAction = state.proposedAction;

    if (!drawnCard || !currentWorld || !proposedAction) {
      return;
    }

    state = { ...state, persistenceStatus: resolveSavingStatus(environment, cloudActive()) };
    refresh();

    try {
      const result = await commitWorldAction(
        currentWorld,
        drawnCard,
        state.selection.tileIds,
        proposedAction.randomSeed,
        proposedAction,
        state.selection,
      );

      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        selection: createSelectionForCard(null),
        statusMessage: result.message,
        loadError: null,
        persistenceStatus: resolveSavedStatus(environment, cloudActive()),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The action could not be saved. The world was not changed.";
      state = { ...state, statusMessage: message, persistenceStatus: resolveFailedStatus(environment, error, cloudActive()) };
    }

    refresh();
  });

  sidebar.discardCardButton.addEventListener("click", async () => {
    const currentWorld = state.world;
    const drawnCard = state.drawnCard;
    if (!currentWorld || !drawnCard) {
      return;
    }

    const discardedName = drawnCard.name;
    state = { ...state, persistenceStatus: resolveSavingStatus(environment, cloudActive()) };
    refresh();

    try {
      const result = await commitDiscardActiveCard(currentWorld);
      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        selection: createSelectionForCard(null),
        statusMessage: `Discarded "${discardedName}".`,
        loadError: null,
        persistenceStatus: resolveSavedStatus(environment, cloudActive()),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The card could not be discarded.";
      state = { ...state, statusMessage: message, persistenceStatus: resolveFailedStatus(environment, error, cloudActive()) };
    }

    refresh();
  });

  if (import.meta.env.DEV) {
    sidebar.devLoadScenarioButton.addEventListener("click", async () => {
      try {
        const scenarioId = sidebar.devScenarioSelect.value as DevScenarioId;
        const world = createDevScenario(scenarioId);
        const worlds = await getWorldRepository().listWorlds();

        for (const summary of worlds) {
          await getWorldRepository().deleteWorld(summary.id);
        }

        await getWorldRepository().createWorld(world);
        const hadMap = Boolean(worldMap);

        if (!worldMap) {
          mountWorldMap(world);
        }

        state = {
          ...state,
          world,
          selection: createEmptySelection("single"),
          drawnCard: null,
          proposedAction: null,
          selectedRouteId: null,
          statusMessage: `Loaded dev scenario "${scenarioId}".`,
          loadError: null,
          persistenceStatus: resolveSavedStatus(environment, cloudActive()),
        };

        refresh({ fitMap: hadMap });
        return;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The dev scenario could not be loaded.";
        state = { ...state, statusMessage: message, persistenceStatus: resolveFailedStatus(environment, error, cloudActive()) };
      }

      refresh();
    });
  } else {
    sidebar.devScenarioSelect.hidden = true;
    sidebar.devLoadScenarioButton.hidden = true;
  }

  sidebar.devExpandTileButton.addEventListener("click", async () => {
    const currentWorld = state.world;
    if (!currentWorld) {
      return;
    }

    const selectedTileId = state.selection.tileIds[0];

    if (!selectedTileId || !isBoundaryTile(currentWorld, selectedTileId)) {
      state = {
        ...state,
        statusMessage: "Select a boundary tile with open space beside it.",
      };
      refresh();
      return;
    }

    const coordinate = getFirstMissingCardinalNeighbour(
      currentWorld,
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

    state = { ...state, persistenceStatus: resolveSavingStatus(environment, cloudActive()) };
    refresh();

    try {
      const result = await commitTileCreation(currentWorld, coordinate, "empty");

      state = {
        ...state,
        world: result.world,
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: result.message,
        loadError: null,
        persistenceStatus: resolveSavedStatus(environment, cloudActive()),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The action could not be saved. The world was not changed.";
      state = { ...state, statusMessage: message, persistenceStatus: resolveFailedStatus(environment, error, cloudActive()) };
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

    state = { ...state, persistenceStatus: resolveSavingStatus(environment, cloudActive()) };
    refresh();

    try {
      const importedWorld = await importWorldFromFile(file);
      const worlds = await getWorldRepository().listWorlds();

      for (const summary of worlds) {
        await getWorldRepository().deleteWorld(summary.id);
      }

      const stored = await getWorldRepository().createWorld(importedWorld);
      setActiveStoredRevision(stored.revision);
      const hadMap = Boolean(worldMap);

      state = {
        ...state,
        world: importedWorld,
        selection: createSelectionForCard(null),
        drawnCard: null,
        proposedAction: null,
        selectedRouteId: null,
        statusMessage: `Imported "${importedWorld.name}".`,
        loadError: null,
        persistenceStatus: resolveSavedStatus(environment, cloudActive()),
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
      state = { ...state, statusMessage: message, persistenceStatus: resolveFailedStatus(environment, error, cloudActive()) };
    }

    sidebar.importInput.value = "";
    refresh();
  });

  if (environment.supabase && supabaseClient) {
    sidebar.authSignInButton.addEventListener("click", async () => {
      try {
        state = {
          ...state,
          authMessage: "Signing in…",
        };
        refresh();

        await signInWithPassword(
          supabaseClient,
          sidebar.authEmailInput.value,
          sidebar.authPasswordInput.value,
        );
        sidebar.authPasswordInput.value = "";
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Sign in failed.";
        state = { ...state, authMessage: message };
        refresh();
      }
    });

    sidebar.authSignUpButton.addEventListener("click", async () => {
      try {
        state = {
          ...state,
          authMessage: "Creating account…",
        };
        refresh();

        const result = await signUpWithPassword(
          supabaseClient,
          sidebar.authEmailInput.value,
          sidebar.authPasswordInput.value,
        );
        sidebar.authPasswordInput.value = "";

        state = {
          ...state,
          authMessage: result.session
            ? "Account created and signed in."
            : "Account created. Check your email if confirmation is required, then sign in.",
        };
        refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Account creation failed.";
        state = { ...state, authMessage: message };
        refresh();
      }
    });

    sidebar.authSignOutButton.addEventListener("click", async () => {
      try {
        await signOut(supabaseClient);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Sign out failed.";
        state = { ...state, authMessage: message };
        refresh();
      }
    });
  }

  refresh();
}

bootstrap().catch((error) => {
  console.error("Failed to start Nexus Map:", error);
});

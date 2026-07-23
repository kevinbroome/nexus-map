# Cloud persistence architecture

Nexus Map stores world state through a **repository abstraction**. Local persistence remains the default; Supabase cloud storage is available when configured and signed in.

## Persistence boundary

```
UI (sidebar, main.ts)
        |
commitWorldAction / commitDeckAction / commitTileCreation
        |
persistCommittedWorld
        |
getWorldRepository().saveWorld()
        |
WorldRepository
    /                    \
LocalWorldRepository     SupabaseWorldRepository (when supabase mode + signed in)
    |
worldStorage.ts (localStorage)
```

### Central functions

| Concern | Module | Function |
|---------|--------|----------|
| Card commit save | `src/world/commitWorldAction.ts` | `commitWorldAction` → `persistCommittedWorld` |
| Deck commit save | `src/world/commitDeckAction.ts` | `commitDrawCard` / `commitDiscardActiveCard` |
| Tile creation save | `src/world/commitTileCreation.ts` | `commitTileCreation` |
| Persist adapter | `src/persistence/persistCommittedWorld.ts` | `persistCommittedWorld` |
| Repository instance | `src/persistence/repositoryContext.ts` | `setWorldRepository` / `getWorldRepository` |
| App startup load | `src/main.ts` | `initializeWorld` → `listWorlds` / `loadWorld` / `createWorld` |
| Auth | `src/supabase/auth.ts` | `signInWithPassword` / `signUpWithPassword` / `signOut` |
| JSON export | `src/persistence/worldExport.ts` | `exportWorldToFile` / `serializeWorld` |
| JSON import | `src/persistence/worldExport.ts` | `importWorldFromFile` / `parseWorld` |

### localStorage keys

| Key | Purpose |
|-----|---------|
| `nexus-map-world` | Serialized world JSON (unchanged format; import/export compatible) |
| `nexus-map-world-meta` | Local revision + `savedAt` timestamp |

Theme preference uses a separate key (`nexus-map-theme`) in `src/visuals/themeManager.ts`.

### Atomic commit behaviour

1. Rules engine produces a proposed world (`proposeCardPlay`, etc.).
2. `commitWorldAction` builds the committed world in memory.
3. `persistCommittedWorld` calls `repository.saveWorld` with the active stored revision.
4. On success, the caller replaces in-memory truth with the committed world.
5. On failure, the visible world is unchanged and an error is shown.

Persistence failures surface through commit error messages and the `#persistence-status` indicator.

## Repository interface

Defined in `src/persistence/worldRepository.ts`:

- `listWorlds()` — summaries for world picker (local: 0 or 1 world; cloud: all worlds for signed-in user)
- `loadWorld(worldId)` — full `StoredWorld` with revision
- `createWorld(world)` — initial save
- `saveWorld(worldId, world, options?)` — upsert with optional optimistic revision check
- `deleteWorld(worldId)`

All methods are **async**, including the local adapter.

Typed errors live in `src/persistence/repositoryErrors.ts`. Raw Supabase messages are not shown in the main UI.

## Environment configuration

| Variable | Purpose |
|----------|---------|
| `VITE_WORLD_REPOSITORY` | `local` (default) or `supabase` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |

Legacy `VITE_SUPABASE_ANON_KEY` is accepted as a fallback for the publishable key.

**Never** put the Supabase service-role key in frontend environment variables.

## Manual Supabase setup

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and select your project.
2. Copy the **Project URL** and **publishable key** (Settings → API).
3. Create `.env.local` in the project root (not committed):

   ```
   VITE_WORLD_REPOSITORY=local
   VITE_SUPABASE_URL=<project URL>
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```

4. Restart the Vite dev server after changing environment variables.
5. Do **not** copy the service-role key into the frontend.
6. Connecting GitHub to Supabase does **not** configure your local Vite environment — you still need `.env.local`.
7. Verify connectivity from the terminal:

   ```bash
   npm run verify:supabase
   ```

   This checks `{url}/auth/v1/health` (no database access required).

8. Link the CLI to your hosted project and push migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   Migrations live in `supabase/migrations/`:
   - `20260723100000_nexus_schema_metadata.sql` — schema metadata
   - `20260723110000_worlds.sql` — `public.worlds` table + RLS

9. In the Supabase dashboard, enable **Email** auth (Authentication → Providers). Adjust email confirmation settings if you want instant sign-up during development.

## Step 2 — cloud worlds + auth

### When cloud persistence is active

Cloud saves are used only when **both** are true:

1. `VITE_WORLD_REPOSITORY=supabase` in `.env.local`
2. The user is signed in (sidebar **Cloud account** panel)

Otherwise the app falls back to local storage (even if Supabase credentials are present). This keeps existing local-only workflows safe while you test cloud features.

### `public.worlds` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Matches `WorldState.id` |
| `user_id` | uuid FK | `auth.users.id`; RLS scoped |
| `name` | text | World display name |
| `world_data` | jsonb | Full serialized world |
| `world_version` | integer | Schema version from `WorldState.version` |
| `revision` | bigint | Optimistic concurrency counter (starts at 1) |
| `created_at` / `updated_at` | timestamptz | Auto-maintained |

Row Level Security: each user can select/insert/update/delete **only their own** rows.

### Auth UI

The sidebar **Cloud account** section provides email/password sign-in, sign-up, and sign-out. On sign-in or sign-out the app reconfigures the repository and reloads the world from the active backend.

### Optimistic concurrency

`persistCommittedWorld` passes `expectedRevision` from the last successful load/save. If another client updated the row first, `RevisionConflictError` is raised and the UI shows a conflict message instead of overwriting.

### Enabling cloud mode locally

1. Push migrations (`npx supabase db push`).
2. Set `VITE_WORLD_REPOSITORY=supabase` in `.env.local`.
3. Restart `npm run dev`.
4. Sign up or sign in via the sidebar.
5. Play normally — commits save to Supabase. Check the dev diagnostics panel for repository mode and auth status.

To return to local-only saves, set `VITE_WORLD_REPOSITORY=local` and restart.

## Development diagnostics

When running `npm run dev`, the developer tools panel shows:

- Repository mode
- Supabase configuration present/missing
- Supabase client initialised/unavailable
- Authenticated user (from `auth.getSession()`)
- Cloud world repository status

Keys are never displayed.

## Future cloud steps (Step 3+)

- Offline write queue and retry
- Conflict resolution UI (reload vs force save)
- Multi-world picker in the sidebar
- Optional realtime sync
- Local → cloud migration UX

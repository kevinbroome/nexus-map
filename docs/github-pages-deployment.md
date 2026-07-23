# GitHub Pages deployment

Nexus Map deploys to GitHub Pages from the `main` branch using GitHub Actions. Production builds use Supabase cloud persistence; local development continues to use `npm run dev` with a root base path (`/`).

## Resolved production URL

Inspect the Git remote to determine the Pages URL:

| Remote | Value |
|--------|-------|
| GitHub owner | `kevinbroome` |
| Repository | `nexus-map` |
| User Pages repo? | No (`nexus-map`, not `<owner>.github.io`) |

**Expected production URL:**

```text
https://kevinbroome.github.io/nexus-map/
```

The Vite base path is derived at build time from `GITHUB_REPOSITORY` (see `src/config/viteBasePath.ts`). It is **not** hard-coded in application logic.

If the repository is renamed, or moved to a user Pages repo (`<owner>.github.io`), the base path updates automatically on the next deployment.

## How base paths work

| Environment | Vite `base` | Example app URL |
|-------------|-------------|-----------------|
| Local dev (`npm run dev`) | `/` | `http://localhost:5173/` |
| GitHub Pages (project site) | `/<repository-name>/` | `https://<owner>.github.io/<repository-name>/` |
| GitHub Pages (user site) | `/` | `https://<owner>.github.io/` |

Auth redirects use `getAuthenticationRedirectUrl()` (`src/config/applicationUrl.ts`), which combines `window.location.origin` with `import.meta.env.BASE_URL`.

## GitHub setup (manual)

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Go to **Settings → Secrets and variables → Actions**.

### Repository variable

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |

### Repository secret

| Name | Value |
|------|-------|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable (anon) key |

The publishable key is safe to embed in a browser bundle, but it is **not** a service-role key. Never add `VITE_SUPABASE_SERVICE_ROLE_KEY` or any service-role secret to GitHub Actions or the frontend.

5. Confirm the default branch is `main` (used by `.github/workflows/deploy-pages.yml`).
6. Push the workflow to `main`.
7. Open the **Actions** tab and verify **Deploy Nexus Map to GitHub Pages** succeeds.
8. Copy the deployed URL from the workflow summary or **Settings → Pages**.

You can also trigger a manual deployment from **Actions → Deploy Nexus Map to GitHub Pages → Run workflow**.

## Supabase setup (manual)

After the GitHub Pages URL is known:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to the exact production URL, including the repository path and trailing slash:

   ```text
   https://kevinbroome.github.io/nexus-map/
   ```

3. Add **Redirect URLs**:
   - Local development: `http://localhost:5173/**`
   - Production: `https://kevinbroome.github.io/nexus-map/**`

   Prefer exact paths over broad wildcards where possible.

4. Enable **Email** under **Authentication → Providers**.

5. Review **Authentication → Email Templates** (Confirm signup, Reset password, Magic link). When the app passes `emailRedirectTo` / `redirectTo`, templates should use `{{ .RedirectTo }}` so confirmation links return to the deployed app (including the `/nexus-map/` base path), not only `{{ .SiteURL }}`.

The application passes the current frontend URL automatically during sign-up and password reset (`src/supabase/auth.ts`).

## Workflow behaviour

File: `.github/workflows/deploy-pages.yml`

On push to `main` (or manual dispatch):

1. `npm ci`
2. `npm test -- --run`
3. `npm run build` with production Supabase env vars
4. Upload `dist/`
5. Deploy to GitHub Pages

Deployment is blocked if tests or the build fail.

Production build env:

- `VITE_WORLD_REPOSITORY=supabase`
- `VITE_SUPABASE_URL` from repository variables
- `VITE_SUPABASE_PUBLISHABLE_KEY` from repository secrets
- `GITHUB_PAGES_BUILD=true` and `GITHUB_REPOSITORY` for the correct asset base path

## Local development

Local dev is unchanged:

```bash
npm run dev
```

Use `.env.local` for local Supabase credentials. Set `VITE_WORLD_REPOSITORY=local` to keep browser saves in localStorage, or `supabase` plus sign-in to test cloud mode locally.

`npm run build` without `GITHUB_PAGES_BUILD=true` produces a root-base (`/`) build suitable for local preview:

```bash
npm run build
npm run preview
```

## Routing and SPA fallback

Nexus Map is a single-page application with **no client-side path routing** (no `/about`, `/world/:id`, etc.). All interaction happens on the repository root URL.

Because of that, **no `404.html` SPA fallback is required** for GitHub Pages. Email confirmation and sign-in return to the app root, which loads `index.html` directly.

If route-based navigation is added later, revisit GitHub Pages SPA fallback strategy.

## Diagnostics

In development mode, the **Developer tools** panel shows:

- Runtime (Development / Production)
- Base URL (`import.meta.env.BASE_URL`)
- Repository mode
- Supabase configuration status
- Auth redirect URL

In production, if Supabase mode is selected but configuration is missing, the app shows a user-facing configuration error instead of failing silently.

## Verification checklist

- [ ] GitHub Actions workflow passes on `main`
- [ ] Pages site loads CSS, JavaScript, and Leaflet assets
- [ ] Asset URLs include `/nexus-map/` on the project site
- [ ] Sign-up confirmation email returns to the GitHub Pages URL
- [ ] Local sign-up still redirects to `http://localhost:5173/`
- [ ] Signed-in users on desktop and mobile reach the same cloud world
- [ ] No service-role key in frontend code or GitHub secrets

## Related docs

- Cloud persistence architecture: `docs/cloud-persistence.md`
- Environment template: `.env.example`

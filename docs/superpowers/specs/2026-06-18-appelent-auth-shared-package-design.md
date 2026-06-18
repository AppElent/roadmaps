# `@appelent/auth` Shared Package — Design

**Date:** 2026-06-18
**Status:** Approved (design); pending implementation plan
**Goal:** Extract the custom Clerk auth UI from roadmaps into a private, versioned shared package, set up a workspace monorepo to host it and future shared packages, and migrate roadmaps to consume it as the first consumer.

## Background

The auth module (`src/components/auth/` + `src/lib/authEnv.ts` + theme helpers) was built in roadmaps and documented for copy-porting via `PORTING.md`. Copy-porting means three divergent copies across roadmaps, workouts, and satisfactory. This project replaces copy-porting with a real published package so fixes propagate via version bumps.

All three consumer apps share one stack: **TanStack React Start + Vite, React 19, `@clerk/clerk-react` ^5.61, Tailwind v4, npm**. They are separate repos, each independently deployed (own Convex + Cloudflare Worker).

## Decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Distribution | Private **GitHub Packages** registry; apps consume a versioned `@appelent/*` dependency |
| Repo structure | **pnpm workspace monorepo** `appelent-packages`, `packages/auth` first |
| Styling delivery | Tailwind **`@source` scan** — consumer's Tailwind v4 generates the utilities |
| API boundary | **Stack-locked lift-and-shift** — peer deps on react/clerk/tanstack-router; bundle cn/authEnv/theme |
| First consumer | Migrate **roadmaps** in this same effort (proving ground) |
| Repo name / scope | `appelent-packages` / `@appelent/auth` |
| Package manager | **pnpm** for the package repo (apps stay on npm) |

## Non-goals (YAGNI / follow-ups)

- Migrating workouts and satisfactory (separate follow-up specs; repeats the consumer-integration steps).
- Additional packages (`@appelent/ui`, `@appelent/convex-helpers`, …).
- Changesets and a CI publish-on-tag workflow (add when a second package exists; manual publish for now).
- Decoupling framework edges (linkComponent prop, appearance slot, env-injected creds) — only if a non-TanStack/non-Vite consumer ever appears.

## Architecture

### Repository layout
A new private repo `appelent-packages` on github.com/AppElent:
```
appelent-packages/
  pnpm-workspace.yaml          # packages: ["packages/*"]
  package.json                 # private root; scripts: build/test/lint/typecheck across workspace
  tsconfig.base.json           # shared compiler options (strict, react-jsx, bundler resolution)
  biome.json                   # tabs, double quotes (match the apps)
  .npmrc                       # @appelent:registry=https://npm.pkg.github.com
  .gitignore                   # node_modules, dist
  packages/
    auth/                      # @appelent/auth
      package.json
      tsconfig.json            # extends ../../tsconfig.base.json
      tsup.config.ts
      vitest.config.ts
      src/
        index.ts               # public barrel
        components/...          # primitives, AuthCard, forms, ProfilePanel, HeaderUser,
                                # AppearanceSettings, TestLoginButton, AuthConfigProvider
        lib/
          utils.ts             # cn
          authEnv.ts           # shouldShowTestLogin
          theme.ts             # ThemeMode, get/apply/setThemeMode, reconcileTheme, THEME_INIT_SCRIPT
        ThemeSync.tsx
        types.ts               # AuthConfig, SlotClassNames, SocialProvider, clerkErrorMessage
        __tests__/...          # migrated vitest tests
      tokens.css               # default --auth-* values (light + dark)
```
Future packages drop into `packages/` with no restructuring.

### `@appelent/auth` package.json (key fields)
- `"name": "@appelent/auth"`, `"version": "0.1.0"`, `"private": false`, `"type": "module"`.
- `"publishConfig": { "registry": "https://npm.pkg.github.com" }`.
- `"exports"`: `"."` → `{ types: ./dist/index.d.ts, import: ./dist/index.js }`; `"./tokens.css"` → `./tokens.css`.
- `"files": ["dist", "tokens.css"]`.
- `"peerDependencies"`: `react`, `react-dom`, `@clerk/clerk-react`, `@tanstack/react-router`.
- `"dependencies"`: `clsx`, `tailwind-merge`.
- `"devDependencies"`: `tsup`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom`, `@types/react`, `@types/react-dom`, `@biomejs/biome`, and the peers for local typecheck/test.
- `"scripts"`: `build` (tsup), `dev` (tsup --watch), `test` (vitest run), `typecheck` (tsc --noEmit), `lint` (biome check).

### Build
`tsup src/index.ts --format esm --dts --clean`. React, react-dom, `@clerk/clerk-react`, `@tanstack/react-router` are external (peers); `clsx`/`tailwind-merge` are dependencies (resolved by the consumer, externalized by tsup's node_modules default). The package ships JS containing the Tailwind class strings — it does **not** compile Tailwind itself (the consumer does, via `@source`).

### Public API (barrel exports from `src/index.ts`)
- Components: `AuthCard`, `SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ProfilePanel`, `TestLoginButton`, `HeaderUser`, `AppearanceSettings`, `AuthConfigProvider`, `AuthField`, `AuthButton`, `AuthError`, `ThemeSync`.
- Helpers/hooks: `useAuthConfig`, `DEFAULT_AUTH_CONFIG`, `shouldShowTestLogin`, `reconcileTheme`, `getInitialMode`, `applyThemeMode`, `setThemeMode`, `THEME_INIT_SCRIPT`, `clerkErrorMessage`.
- Types: `AuthConfig`, `SlotClassNames`, `SocialProvider`, `ThemeMode`.
- `cn` stays internal (not exported — consumers have their own).

### Behavior changes during extraction (minimal, intentional)
- `HeaderUser` reads link targets from `useAuthConfig().paths` (`account`, `signIn`) instead of hardcoded literals. Safe because the prebuilt package has no registered TanStack router, so `Link`'s `to` is loosely typed there; at runtime it navigates correctly in the consumer.
- `ProfilePanel` continues to render `AppearanceSettings`, which now lives inside the package.
- `THEME_INIT_SCRIPT` is exported as a constant so the consumer can inline the pre-paint FOUC script in its document head without copying a string.
- Everything else is moved verbatim; the existing tests come along unchanged.

### Styling & tokens
- `tokens.css` defines concrete default `--auth-*` values under light and dark selectors (`.light` / `.dark` to match the apps' theming, plus a `:root` fallback). No app-specific brand references.
- Consumer steps: `import "@appelent/auth/tokens.css"`, then override `--auth-accent`/etc. in their own stylesheet; add `@source "../node_modules/@appelent/auth/dist";` to their Tailwind entry so utilities are generated.

## Consumer integration — roadmaps migration

1. **Registry auth:** add `.npmrc` with `@appelent:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` (token = a GitHub PAT with `read:packages`; set in the shell/CI env, never committed). *(Ops step — the user provides the PAT.)*
2. **Install:** `npm i @appelent/auth` (peers already present).
3. **Tailwind:** add `@source "../node_modules/@appelent/auth/dist";` to `src/styles.css`.
4. **Tokens:** import `@appelent/auth/tokens.css`; keep roadmaps' `--auth-*` overrides (already mapped to `--rm-*`).
5. **Swap imports:** replace usages from `@/components/auth/*`, `@/lib/authEnv`, theme helpers, `ThemeSync`, and `@/integrations/clerk/header-user` with imports from `@appelent/auth`. Inline `THEME_INIT_SCRIPT` from the package in `__root.tsx`.
6. **Keep app-side:** the route files (`/sign-in`, `/sign-up`, `/forgot-password`, `/account`), ClerkProvider `signInUrl`/`signUpUrl`, and brand token overrides.
7. **Delete duplicates:** remove `src/components/auth/`, `src/lib/authEnv.ts`, the moved theme pieces, `src/components/ThemeSync.tsx`, `src/integrations/clerk/header-user.tsx`, and `src/components/auth/PORTING.md` (superseded). Keep roadmaps' own `theme.ts` only if other app code uses it; otherwise rely on the package's exports.
8. **Verify:** `npm run check`, `npx tsc --noEmit`, `npm run test`, `npm run build`, then a `deploy:dev` smoke.

### Local development loop
Before publishing, link the package into roadmaps for fast iteration:
- `pnpm --filter @appelent/auth build` in the package repo, then in roadmaps use a `file:` dependency (`"@appelent/auth": "file:../appelent-packages/packages/auth"`) or `npm link`. Switch to the published version once stable.

## Publishing & versioning
- Manual, documented flow: bump `packages/auth` version, `pnpm --filter @appelent/auth build`, `pnpm --filter @appelent/auth publish` (authenticated to GitHub Packages with a `write:packages` PAT).
- Start at `0.1.0`. Semver going forward.
- Changesets + CI publish-on-tag: documented as a fast-follow, not built now.

## Testing & tooling
- The package keeps the migrated vitest tests (jsdom component tests + the pure-logic tests for `shouldShowTestLogin`/`reconcileTheme`).
- Gates in the package: `tsup` build succeeds, `tsc --noEmit`, `vitest run`, `biome check`.
- Roadmaps gates after migration: `npm run check`, `tsc --noEmit`, full `vitest`, `npm run build`.

## Risks & notes
- **Tailwind `@source` + node_modules:** the directive path is relative to the CSS file; verify the generated utilities actually appear in the roadmaps build (smoke-test a styled auth page) — this is the main thing that can silently break.
- **Peer React/Clerk singletons:** peerDependencies (not bundled) are essential so Clerk's React context and React itself are single instances; the build must mark them external.
- **`import.meta.env` in TestLoginButton:** resolves against the *consumer's* Vite build (correct), because the package is consumed as source-level ESM and Vite inlines env per app. Confirm the test-login button still gates correctly after migration.
- **GitHub Packages auth:** both publish (write) and install (read) need a PAT; document the `.npmrc`/env setup. CI for the apps will also need the read token.

## Phases (for the implementation plan)
1. Scaffold `appelent-packages` (pnpm workspace, root config, tooling).
2. Create `@appelent/auth`: move the module + tests, wire `index.ts`, `tsup`, `tokens.css`, package.json; get build + test + typecheck green.
3. Publish privately (or at least produce a linkable build) and document the `.npmrc`/PAT flow.
4. Migrate roadmaps to consume it; delete duplicates; verify and deploy:dev smoke.

# `@appelent/auth` Shared Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract roadmaps' custom Clerk auth module into a private, versioned `@appelent/auth` package inside a new pnpm workspace monorepo, then migrate roadmaps to consume it.

**Architecture:** New repo `appelent-packages` (pnpm workspace) hosts `packages/auth`. The package mirrors roadmaps' internal folder structure under `src/` and keeps the `@/*` → `src/*` alias, so migrated files need almost no import edits. It builds with tsup to ESM + d.ts, declares react/react-dom/@clerk/clerk-react as peer deps, ships a `tokens.css`, and delivers Tailwind utilities via the consumer's `@source` scan. Roadmaps consumes it through a local `file:` link for validation; real publishing to GitHub Packages is a documented manual step.

**Tech Stack:** pnpm workspaces, tsup (esbuild), TypeScript 6, Vitest (jsdom), Biome, React 19, `@clerk/clerk-react` ^5.61, Tailwind v4.

**Reference spec:** `docs/superpowers/specs/2026-06-18-appelent-auth-shared-package-design.md`

## Conventions

- Biome: tabs, double quotes. New repo uses pnpm; roadmaps stays npm.
- New repo lives at `D:/Dev/appelent-packages` (sibling of `D:/Dev/roadmaps`). Use forward-slash paths in the Bash tool.
- Commit after each task. New-repo commits use plain `git commit`; roadmaps commits append:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- The migrated source files already exist and pass tests in roadmaps — copy them, don't rewrite. Only the edits shown here are needed.

## File Structure (the package)

```
D:/Dev/appelent-packages/
  pnpm-workspace.yaml
  package.json                 # private workspace root
  tsconfig.base.json
  biome.json
  .gitignore
  .npmrc
  packages/auth/
    package.json               # @appelent/auth
    tsconfig.json
    tsup.config.ts
    vitest.config.ts
    tokens.css
    src/
      index.ts                 # public barrel
      components/auth/*         # copied verbatim (+ __tests__)
      components/account/AppearanceSettings.tsx
      components/ThemeSync.tsx
      integrations/clerk/header-user.tsx   # edited: config-driven, <a href>
      lib/utils.ts authEnv.ts theme.ts     # theme.ts: + THEME_INIT_SCRIPT
```

---

## PHASE 1 — Scaffold the workspace repo

### Task 1: Create repo + workspace config

**Files:** all new under `D:/Dev/appelent-packages/`

- [ ] **Step 1: Ensure pnpm is available**

Run: `corepack enable pnpm && pnpm --version`
Expected: prints a version (e.g. 9.x). If `corepack` is missing, run `npm i -g pnpm` instead.

- [ ] **Step 2: Create the repo and root files**

```bash
mkdir -p /d/Dev/appelent-packages/packages
cd /d/Dev/appelent-packages
git init
```

Create `D:/Dev/appelent-packages/pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

Create `D:/Dev/appelent-packages/package.json`:
```json
{
	"name": "appelent-packages",
	"private": true,
	"type": "module",
	"scripts": {
		"build": "pnpm -r build",
		"test": "pnpm -r test",
		"typecheck": "pnpm -r typecheck",
		"lint": "biome check ."
	},
	"devDependencies": {
		"@biomejs/biome": "^2.5.0"
	}
}
```

Create `D:/Dev/appelent-packages/tsconfig.base.json`:
```json
{
	"compilerOptions": {
		"target": "ES2022",
		"lib": ["ES2022", "DOM", "DOM.Iterable"],
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"jsx": "react-jsx",
		"strict": true,
		"skipLibCheck": true,
		"esModuleInterop": true,
		"resolveJsonModule": true
	}
}
```

Create `D:/Dev/appelent-packages/biome.json`:
```json
{
	"$schema": "https://biomejs.dev/schemas/2.5.0/schema.json",
	"formatter": { "enabled": true, "indentStyle": "tab" },
	"javascript": { "formatter": { "quoteStyle": "double" } },
	"files": { "ignoreUnknown": true }
}
```

Create `D:/Dev/appelent-packages/.gitignore`:
```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/appelent-packages
git add -A
git commit -m "chore: scaffold appelent-packages pnpm workspace"
```

---

## PHASE 2 — Build `@appelent/auth`

### Task 2: Package manifest + build/test config

**Files:** new under `D:/Dev/appelent-packages/packages/auth/`

- [ ] **Step 1: Create `packages/auth/package.json`**

```json
{
	"name": "@appelent/auth",
	"version": "0.1.0",
	"type": "module",
	"license": "UNLICENSED",
	"publishConfig": { "registry": "https://npm.pkg.github.com" },
	"repository": {
		"type": "git",
		"url": "https://github.com/AppElent/appelent-packages.git",
		"directory": "packages/auth"
	},
	"files": ["dist", "tokens.css"],
	"exports": {
		".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
		"./tokens.css": "./tokens.css"
	},
	"scripts": {
		"build": "tsup",
		"dev": "tsup --watch",
		"typecheck": "tsc --noEmit",
		"test": "vitest run",
		"lint": "biome check ."
	},
	"peerDependencies": {
		"react": "^19.0.0",
		"react-dom": "^19.0.0",
		"@clerk/clerk-react": "^5.61.0"
	},
	"dependencies": {
		"clsx": "^2.1.1",
		"tailwind-merge": "^3.0.0"
	},
	"devDependencies": {
		"@clerk/clerk-react": "^5.61.3",
		"@testing-library/dom": "^10.4.1",
		"@testing-library/react": "^16.3.0",
		"@types/react": "^19.2.0",
		"@types/react-dom": "^19.2.0",
		"jsdom": "^29.1.1",
		"react": "^19.2.0",
		"react-dom": "^19.2.0",
		"tsup": "^8.3.0",
		"typescript": "^6.0.2",
		"vitest": "^4.1.9"
	}
}
```

> Note: `@tanstack/react-router` is intentionally NOT a dependency — `HeaderUser` is changed to use `<a href>` (Task 4), so the package has zero router coupling.

- [ ] **Step 2: Create `packages/auth/tsconfig.json`**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"baseUrl": ".",
		"paths": { "@/*": ["src/*"] },
		"noEmit": true
	},
	"include": ["src"]
}
```

- [ ] **Step 3: Create `packages/auth/tsup.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	external: ["react", "react-dom", "@clerk/clerk-react"],
	esbuildOptions(options) {
		options.alias = {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		};
	},
});
```

- [ ] **Step 4: Create `packages/auth/vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: { environment: "node" },
});
```

- [ ] **Step 5: Commit**

```bash
cd /d/Dev/appelent-packages
git add packages/auth
git commit -m "chore(auth): add @appelent/auth package manifest and build config"
```

### Task 3: Copy the auth module source

**Files:** copy from `D:/Dev/roadmaps/src` into `D:/Dev/appelent-packages/packages/auth/src`

- [ ] **Step 1: Copy the files, preserving structure**

```bash
mkdir -p /d/Dev/appelent-packages/packages/auth/src/components/account
mkdir -p /d/Dev/appelent-packages/packages/auth/src/integrations/clerk
mkdir -p /d/Dev/appelent-packages/packages/auth/src/lib
cp -r /d/Dev/roadmaps/src/components/auth /d/Dev/appelent-packages/packages/auth/src/components/
cp /d/Dev/roadmaps/src/components/account/AppearanceSettings.tsx /d/Dev/appelent-packages/packages/auth/src/components/account/
cp /d/Dev/roadmaps/src/components/ThemeSync.tsx /d/Dev/appelent-packages/packages/auth/src/components/
cp /d/Dev/roadmaps/src/integrations/clerk/header-user.tsx /d/Dev/appelent-packages/packages/auth/src/integrations/clerk/
cp /d/Dev/roadmaps/src/lib/utils.ts /d/Dev/appelent-packages/packages/auth/src/lib/
cp /d/Dev/roadmaps/src/lib/authEnv.ts /d/Dev/appelent-packages/packages/auth/src/lib/
cp /d/Dev/roadmaps/src/lib/theme.ts /d/Dev/appelent-packages/packages/auth/src/lib/
rm /d/Dev/appelent-packages/packages/auth/src/components/auth/PORTING.md
```

- [ ] **Step 2: Append `THEME_INIT_SCRIPT` to the package's `src/lib/theme.ts`**

Add this exported constant to the end of `D:/Dev/appelent-packages/packages/auth/src/lib/theme.ts` (it currently lives inline in roadmaps' `__root.tsx`):

```ts
/**
 * Pre-paint script (inline in the document <head>) that applies the stored
 * theme before React hydrates, preventing a flash of unstyled content.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;
```

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/appelent-packages
git add packages/auth/src
git commit -m "feat(auth): import auth module source + THEME_INIT_SCRIPT export"
```

### Task 4: Make `HeaderUser` router-free and config-driven

**Files:** Modify `D:/Dev/appelent-packages/packages/auth/src/integrations/clerk/header-user.tsx`

- [ ] **Step 1: Replace the file contents**

The roadmaps version imports `Link` from `@tanstack/react-router` and hardcodes `to="/account"` / `to="/sign-in"`. Replace it entirely with this version that uses `<a href>` from `useAuthConfig().paths` (no router dependency):

```tsx
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { useAuthConfig } from "@/components/auth/AuthConfigProvider";
import { cn } from "@/lib/utils";

export default function HeaderUser() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const config = useAuthConfig();
	const [open, setOpen] = useState(false);
	const initials =
		(user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?").toUpperCase();

	return (
		<>
			<SignedIn>
				<div className="relative">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--auth-accent)] text-sm font-medium text-[var(--auth-accent-fg)]"
						aria-label="Account menu"
					>
						{initials}
					</button>
					{open ? (
						<div className={cn("absolute right-0 mt-2 w-40 rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-1 shadow-md")}>
							<a
								href={config.paths.account}
								onClick={() => setOpen(false)}
								className="block rounded px-3 py-2 text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								Account
							</a>
							<button
								type="button"
								onClick={() => signOut()}
								className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								Sign out
							</button>
						</div>
					) : null}
				</div>
			</SignedIn>
			<SignedOut>
				<a href={config.paths.signIn} className="text-sm font-medium text-[var(--auth-fg)] hover:underline">
					Sign in
				</a>
			</SignedOut>
		</>
	);
}
```

- [ ] **Step 2: Commit**

```bash
cd /d/Dev/appelent-packages
git add packages/auth/src/integrations/clerk/header-user.tsx
git commit -m "feat(auth): make HeaderUser router-free and config-driven"
```

### Task 5: Public barrel + tokens.css

**Files:** Create `packages/auth/src/index.ts` and `packages/auth/tokens.css`

- [ ] **Step 1: Create `packages/auth/src/index.ts`**

```ts
// Components
export { AuthButton } from "@/components/auth/AuthButton";
export { AuthCard } from "@/components/auth/AuthCard";
export { AuthError } from "@/components/auth/AuthError";
export { AuthField } from "@/components/auth/AuthField";
export {
	AuthConfigProvider,
	DEFAULT_AUTH_CONFIG,
	useAuthConfig,
} from "@/components/auth/AuthConfigProvider";
export { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
export { ProfilePanel } from "@/components/auth/ProfilePanel";
export { SignInForm } from "@/components/auth/SignInForm";
export { SignUpForm } from "@/components/auth/SignUpForm";
export { TestLoginButton } from "@/components/auth/TestLoginButton";
export {
	clerkErrorMessage,
	type AuthConfig,
	type SlotClassNames,
	type SocialProvider,
} from "@/components/auth/types";
export { AppearanceSettings } from "@/components/account/AppearanceSettings";
export { ThemeSync } from "@/components/ThemeSync";
export { default as HeaderUser } from "@/integrations/clerk/header-user";
// Lib
export { shouldShowTestLogin } from "@/lib/authEnv";
export {
	applyThemeMode,
	getInitialMode,
	reconcileTheme,
	setThemeMode,
	THEME_INIT_SCRIPT,
	type ThemeMode,
} from "@/lib/theme";
```

- [ ] **Step 2: Create `packages/auth/tokens.css`**

```css
:root,
.light {
	--auth-bg: oklch(98% 0.004 240);
	--auth-fg: oklch(25% 0.02 240);
	--auth-muted: oklch(50% 0.018 240);
	--auth-card-bg: oklch(100% 0 0);
	--auth-border: oklch(90% 0.008 240);
	--auth-radius: 0.625rem;
	--auth-field-bg: oklch(100% 0 0);
	--auth-accent: oklch(58% 0.16 145);
	--auth-accent-fg: oklch(99% 0 0);
	--auth-error: oklch(58% 0.18 25);
}

.dark {
	--auth-bg: oklch(16% 0.012 250);
	--auth-fg: oklch(92% 0.01 240);
	--auth-muted: oklch(70% 0.02 240);
	--auth-card-bg: oklch(20% 0.012 250);
	--auth-border: oklch(30% 0.01 240);
	--auth-radius: 0.625rem;
	--auth-field-bg: oklch(24% 0.012 250);
	--auth-accent: oklch(64% 0.15 145);
	--auth-accent-fg: oklch(18% 0.02 240);
	--auth-error: oklch(70% 0.15 25);
}
```

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/appelent-packages
git add packages/auth/src/index.ts packages/auth/tokens.css
git commit -m "feat(auth): add public barrel export and default tokens.css"
```

### Task 6: Install, typecheck, test, build green

**Files:** none (verification)

- [ ] **Step 1: Install workspace deps**

Run: `cd /d/Dev/appelent-packages && pnpm install`
Expected: installs without errors; `node_modules` created.

- [ ] **Step 2: Typecheck the package**

Run: `cd /d/Dev/appelent-packages/packages/auth && pnpm typecheck`
Expected: exits 0. (If `@/` paths fail to resolve, confirm `tsconfig.json` `paths` is present.)

- [ ] **Step 3: Run the package tests**

Run: `cd /d/Dev/appelent-packages/packages/auth && pnpm test`
Expected: all migrated auth tests pass (17 tests across 6 files).

- [ ] **Step 4: Build**

Run: `cd /d/Dev/appelent-packages/packages/auth && pnpm build`
Expected: `dist/index.js` and `dist/index.d.ts` produced, no errors. (If esbuild can't resolve `@/`, confirm the `esbuildOptions.alias` in `tsup.config.ts`.)

- [ ] **Step 5: Lint**

Run: `cd /d/Dev/appelent-packages && pnpm lint`
Expected: no errors (run `pnpm exec biome check --write .` to autofix formatting, then re-run).

- [ ] **Step 6: Commit any formatting fixes**

```bash
cd /d/Dev/appelent-packages
git add -A
git commit -m "chore(auth): formatting + verified build/test/typecheck green" || echo "nothing to commit"
```

---

## PHASE 3 — Registry auth + publish docs

### Task 7: `.npmrc` and publish documentation

**Files:** Create `D:/Dev/appelent-packages/.npmrc` and `D:/Dev/appelent-packages/PUBLISHING.md`

- [ ] **Step 1: Create `.npmrc`**

```
@appelent:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- [ ] **Step 2: Create `PUBLISHING.md`**

```md
# Publishing @appelent/* packages (GitHub Packages, private)

## One-time setup
1. Create a GitHub Personal Access Token (classic) with `write:packages` +
   `read:packages` for the AppElent account.
2. Create the GitHub repo `AppElent/appelent-packages` and push this repo to it.
3. Export the token in your shell before publishing:
   - PowerShell: `$env:NODE_AUTH_TOKEN="ghp_..."`

## Publish a package
```bash
pnpm --filter @appelent/auth build
pnpm --filter @appelent/auth publish --no-git-checks
```

## Consume from an app
- Add `.npmrc` with `@appelent:registry=https://npm.pkg.github.com` and the
  `read:packages` token via `${NODE_AUTH_TOKEN}`.
- `npm i @appelent/auth`
```

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/appelent-packages
git add .npmrc PUBLISHING.md
git commit -m "docs: GitHub Packages registry config + publishing guide"
```

> Actual `git remote add` / push / publish are manual ops steps for the user
> (need the GitHub repo + PAT). The roadmaps migration below validates the
> package via a local `file:` link, so publishing is NOT required to proceed.

---

## PHASE 4 — Migrate roadmaps to consume the package

> All roadmaps tasks run in `D:/Dev/roadmaps` on a feature branch
> (`feature/appelent-auth-package`, already checked out).

### Task 8: Link the package into roadmaps

**Files:** Modify `D:/Dev/roadmaps/package.json`

- [ ] **Step 1: Add the file: dependency**

In `D:/Dev/roadmaps/package.json`, add to `"dependencies"`:
```json
		"@appelent/auth": "file:../appelent-packages/packages/auth",
```

- [ ] **Step 2: Install**

Run: `cd /d/Dev/roadmaps && npm install`
Expected: `node_modules/@appelent/auth` exists (symlinked/copied) with a `dist/` folder.

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/roadmaps
git add package.json package-lock.json
git commit -m "chore(auth): add @appelent/auth via local file link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 9: Tailwind `@source` for the package

**Files:** Modify `D:/Dev/roadmaps/src/styles.css`

- [ ] **Step 1: Add the @source directive**

Near the top of `src/styles.css` (after the `@import "tailwindcss";` line), add:
```css
@source "../node_modules/@appelent/auth/dist";
```
(Roadmaps already defines its `--auth-*` tokens, so no `tokens.css` import is needed here.)

- [ ] **Step 2: Commit**

```bash
cd /d/Dev/roadmaps
git add src/styles.css
git commit -m "chore(auth): scan @appelent/auth for Tailwind utilities

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 10: Swap imports to `@appelent/auth`

**Files:** Modify the roadmaps files that import auth pieces.

- [ ] **Step 1: Update each import site**

Make these exact edits:

`src/routes/sign-in.tsx` — replace:
```tsx
import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";
```
with:
```tsx
import { AuthCard, SignInForm } from "@appelent/auth";
```

`src/routes/sign-up.tsx` — replace the two `@/components/auth/...` imports with:
```tsx
import { AuthCard, SignUpForm } from "@appelent/auth";
```

`src/routes/forgot-password.tsx` — replace with:
```tsx
import { AuthCard, ForgotPasswordForm } from "@appelent/auth";
```

`src/routes/account/index.tsx` — replace `import { ProfilePanel } from "@/components/auth/ProfilePanel";` with:
```tsx
import { ProfilePanel } from "@appelent/auth";
```

`src/components/Sidebar.tsx` — replace `import HeaderUser from "@/integrations/clerk/header-user";` with:
```tsx
import { HeaderUser } from "@appelent/auth";
```

`src/routes/index.tsx` — replace `import HeaderUser from "@/integrations/clerk/header-user";` with:
```tsx
import { HeaderUser } from "@appelent/auth";
```

`src/routes/__root.tsx` — replace `import { ThemeSync } from "../components/ThemeSync";` with:
```tsx
import { THEME_INIT_SCRIPT, ThemeSync } from "@appelent/auth";
```
and DELETE the local `const THEME_INIT_SCRIPT = ...;` line in that file (now imported).

- [ ] **Step 2: Typecheck**

Run: `cd /d/Dev/roadmaps && npx tsc --noEmit`
Expected: exits 0. (HeaderUser is now a named export, ThemeSync/THEME_INIT_SCRIPT come from the package.)

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/roadmaps
git add src
git commit -m "refactor(auth): consume auth components from @appelent/auth

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 11: Delete the now-duplicated local files

**Files:** delete from `D:/Dev/roadmaps/src`

- [ ] **Step 1: Remove the migrated files**

```bash
cd /d/Dev/roadmaps
git rm -r src/components/auth
git rm src/lib/authEnv.ts
git rm src/components/ThemeSync.tsx
git rm src/integrations/clerk/header-user.tsx
git rm src/components/account/AppearanceSettings.tsx
```
(Keep `src/lib/theme.ts` — `ThemeToggle` still imports it — and `src/lib/utils.ts` and `src/vite-env.d.ts`.)

- [ ] **Step 2: Typecheck for stragglers**

Run: `cd /d/Dev/roadmaps && npx tsc --noEmit`
Expected: exits 0. If anything still imports a deleted path, switch it to the `@appelent/auth` named export.

- [ ] **Step 3: Commit**

```bash
cd /d/Dev/roadmaps
git add -A
git commit -m "chore(auth): remove local auth module now sourced from @appelent/auth

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 12: Verify roadmaps end-to-end

**Files:** none (verification)

- [ ] **Step 1: Lint + typecheck**

Run: `cd /d/Dev/roadmaps && npm run check && npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 2: Tests**

Run: `cd /d/Dev/roadmaps && npm run test`
Expected: all pass. (Count is lower than before — the auth tests now live in the package.)

- [ ] **Step 3: Build**

Run: `cd /d/Dev/roadmaps && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Styling smoke test (the key risk)**

Run: `cd /d/Dev/roadmaps && npm run dev` (with `npx convex dev` in another terminal). Visit `/sign-in`.
Expected: the auth card is **styled** (card border, accent button, spacing) — proving Tailwind's `@source` generated the package's utilities. If it renders unstyled, the `@source` path in Task 9 is wrong; fix and rebuild.

- [ ] **Step 5: Commit (if any fixes)**

```bash
cd /d/Dev/roadmaps
git add -A
git commit -m "chore(auth): verify @appelent/auth migration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" || echo "nothing to commit"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** repo scaffold (Task 1), package manifest/build/tsup/vitest (Task 2), source migration + THEME_INIT_SCRIPT (Task 3), router-free config-driven HeaderUser (Task 4), barrel + tokens.css (Task 5), green build/test (Task 6), registry/.npmrc/publish docs (Task 7), roadmaps file:-link → @source → import swaps → delete dupes → verify incl. styling smoke (Tasks 8–12).
- **Deviation from "lift-and-shift":** `HeaderUser` switched from TanStack `<Link>` to `<a href>` so the package needs no `@tanstack/react-router` peer and avoids the route-literal typing problem. Documented in Task 4 / spec. All other components moved verbatim.
- **Type consistency:** `@/` alias preserved across package tsconfig (`paths`), tsup (`esbuildOptions.alias`), and vitest (`resolve.alias`) so migrated files resolve unchanged. Barrel export names match the components' actual export names; `HeaderUser` is a default export re-exported as the named `HeaderUser`.
- **Out of scope (no tasks, by design):** workouts/satisfactory migration, additional packages, changesets, CI publish. Actual GitHub repo creation + publish are documented ops steps (Task 7), not automated; roadmaps is validated via `file:` link.
- **Known risk surfaced:** Tailwind `@source` resolution is explicitly smoke-tested in Task 12 Step 4.
```

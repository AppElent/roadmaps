# Landing Page + Docs Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder landing page with a tasteful, theme-aware, blueprint-inflected marketing page showcasing ArchStudio's three tools, and rewrite README.md + CLAUDE.md to reflect the ArchStudio multi-tool reality.

**Architecture:** The landing page (`src/routes/index.tsx`) is a public, standalone SSR route (NOT inside `AppShell`). It is rebuilt on the theme-aware "sea/island" design system that already exists in `src/styles.css` (`.page-wrap`, `.display-title`, `.island-shell`, `.feature-card`, `.island-kicker`, `.site-footer`, `.rise-in`, and `--sea-ink`/`--lagoon-deep`/`--palm`/`--line`/`--surface` tokens with `.dark` variants), inflected with blueprint touches (a hero grid overlay, monospace micro-labels, the mono `AS` badge). It reuses the existing `ThemeToggle`. README and CLAUDE.md are prose-only edits. No backend, schema, dependency, or product-behavior changes.

**Tech Stack:** React 19 + TanStack React Start (file-based routing, SSR), Clerk (`@clerk/clerk-react`), Tailwind v4 + existing CSS-variable design system, Lucide icons, Biome (tabs, double quotes).

---

## Pre-flight context for the implementer

Read these before starting — they explain non-obvious project rules you WILL trip over:

- **Biome formatting is mandatory and strict:** tab indentation, double quotes. Run `npm run check` before every commit; autofix with `npx biome check --write src/`. CI-equivalent gate.
- **Lucide `Map` must be imported aliased:** `import { Map as MapIcon } from "lucide-react"` — Biome's `noShadowRestrictedNames` rejects a bare `Map` import. Other icons import normally.
- **Class-merge helper:** `import { cn } from "@/lib/utils"`. Path aliases `@/*` and `#/*` both map to `src/`.
- **The landing route is intentionally public/unauthenticated** — it uses Clerk's `<SignedIn>`/`<SignedOut>` components for auth-state branching, never a `useQuery`. Do not add auth gating.
- **The design tokens are theme-aware via CSS variables** that flip in `.dark` (set on `<html>` by `ThemeToggle` / the root `THEME_INIT_SCRIPT`). Always reference colors as `var(--token)` (e.g. `text-[var(--sea-ink)]`), never hardcoded hex or `neutral-*` Tailwind classes — those won't flip in dark mode.
- **`src/routeTree.gen.ts` is auto-generated** — this change edits an existing route file, so the route tree does not change and needs no regeneration. Never hand-edit `routeTree.gen.ts`.
- **No new dependencies.** `lucide-react`, `@clerk/clerk-react`, `@tanstack/react-router` are all already installed.
- **There are no unit tests for this work.** The landing page is presentational and adds nothing to `src/lib/` (the Vitest surface). Verification is `npm run check` + `npx tsc --noEmit` + `npm run build` + manual browser check. The existing Vitest suite must remain green but is unaffected.

Branch: continue on `feature/landing-page-and-docs-refresh` (already created; the design spec is committed there).

---

## Task 1: Landing page rewrite

**Files:**
- Modify (full rewrite): `src/routes/index.tsx`

This task produces the complete landing page in one focused file: top bar, blueprint hero, three tool cards, footer. Build it, verify it compiles/lints/types, then commit.

- [ ] **Step 1: Replace `src/routes/index.tsx` with the full implementation below**

Write this exact content (tabs for indentation):

```tsx
import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type LucideIcon, Map as MapIcon, Sparkles, Workflow } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

interface ToolHighlight {
	icon: LucideIcon;
	title: string;
	description: string;
	features: string[];
	status: "live" | "soon";
}

const TOOLS: ToolHighlight[] = [
	{
		icon: MapIcon,
		title: "Roadmaps",
		description: "Plan initiatives on a real-time timeline.",
		features: [
			"Drag & resize across lanes",
			"Custom fields & milestones",
			"Read-only share links",
		],
		status: "live",
	},
	{
		icon: Workflow,
		title: "Diagrams",
		description: "Author Mermaid & PlantUML with a live preview.",
		features: [
			"Instant client-side rendering",
			"Version history",
			"Shareable read-only views",
		],
		status: "live",
	},
	{
		icon: Sparkles,
		title: "AI helper",
		description: "A Claude-powered assistant for your workbench.",
		features: [
			"Draft diagrams from a prompt",
			"Summarize a roadmap",
			"Right inside the editor",
		],
		status: "soon",
	},
];

function PrimaryCta({ children }: { children: string }) {
	return (
		<>
			<SignedOut>
				<SignInButton mode="modal">
					<button
						type="button"
						className="rounded-full bg-[var(--palm)] px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
					>
						{children}
					</button>
				</SignInButton>
			</SignedOut>
			<SignedIn>
				<Link
					to="/dashboard"
					className="rounded-full bg-[var(--palm)] px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
				>
					Go to dashboard
				</Link>
			</SignedIn>
		</>
	);
}

function ToolHighlightCard({
	icon: Icon,
	title,
	description,
	features,
	status,
}: ToolHighlight) {
	return (
		<div
			className={cn(
				"feature-card flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-5",
				status === "soon" && "opacity-70",
			)}
		>
			<div className="flex items-center gap-2">
				<div className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--lagoon-deep)]">
					<Icon size={18} aria-hidden />
				</div>
				<strong className="text-[var(--sea-ink)]">{title}</strong>
				{status === "soon" && (
					<span className="island-kicker ml-auto rounded-full border border-[var(--chip-line)] px-2 py-0.5">
						Soon
					</span>
				)}
			</div>
			<p className="text-sm text-[var(--sea-ink-soft)]">{description}</p>
			<ul className="mt-auto flex flex-col gap-1.5">
				{features.map((feature) => (
					<li
						key={feature}
						className="flex items-center gap-2 text-xs text-[var(--sea-ink-soft)]"
					>
						<span
							className="size-1 rounded-full bg-[var(--lagoon-deep)]"
							aria-hidden
						/>
						{feature}
					</li>
				))}
			</ul>
		</div>
	);
}

function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="page-wrap flex items-center justify-between py-5">
				<div className="flex items-center gap-2">
					<div className="grid size-8 place-items-center rounded-md border border-[var(--line)] font-mono text-xs font-bold text-[var(--sea-ink)]">
						AS
					</div>
					<strong className="text-[var(--sea-ink)]">ArchStudio</strong>
				</div>
				<div className="flex items-center gap-3">
					<ThemeToggle />
					<SignedOut>
						<SignInButton mode="modal">
							<button
								type="button"
								className="rounded-full bg-[var(--palm)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
							>
								Sign in
							</button>
						</SignInButton>
					</SignedOut>
					<SignedIn>
						<Link
							to="/dashboard"
							className="rounded-full bg-[var(--palm)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
						>
							Open app
						</Link>
						<UserButton />
					</SignedIn>
				</div>
			</header>

			<main className="page-wrap flex flex-1 flex-col">
				<section className="rise-in relative isolate flex flex-col items-center py-20 text-center">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 -z-10"
						style={{
							backgroundImage:
								"linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
							backgroundSize: "32px 32px",
							maskImage:
								"radial-gradient(circle at 50% 38%, black, transparent 70%)",
							WebkitMaskImage:
								"radial-gradient(circle at 50% 38%, black, transparent 70%)",
							opacity: 0.55,
						}}
					/>
					<p className="island-kicker mb-4">The architect's workbench</p>
					<h1 className="display-title mb-4 max-w-2xl text-4xl font-medium tracking-tight text-[var(--sea-ink)] sm:text-5xl">
						Design systems, not just slides.
					</h1>
					<p className="mb-8 max-w-xl text-base text-[var(--sea-ink-soft)]">
						Roadmaps, diagrams, and more in one place — a calm home for the
						plans and pictures that shape what you're building.
					</p>
					<PrimaryCta>Start planning</PrimaryCta>
				</section>

				<section className="grid gap-4 pb-16 sm:grid-cols-3">
					{TOOLS.map((tool) => (
						<ToolHighlightCard key={tool.title} {...tool} />
					))}
				</section>
			</main>

			<footer className="site-footer">
				<div className="page-wrap flex flex-col items-center justify-between gap-2 py-6 text-xs text-[var(--sea-ink-soft)] sm:flex-row">
					<span className="font-mono">ArchStudio</span>
					<span>Built with TanStack Start · Convex · Clerk · Cloudflare</span>
				</div>
			</footer>
		</div>
	);
}
```

Notes for the implementer:
- `ThemeToggle` is a default export at `src/components/ThemeToggle.tsx` — import it as `import ThemeToggle from "@/components/ThemeToggle"`.
- The hero grid overlay is a blueprint inflection drawn from the theme-aware `--line` token, masked to fade at the edges. The global `body::after` in `styles.css` already paints a faint grid; this local one strengthens it behind the hero only.
- `.feature-card` supplies the frosted background + hover lift; the explicit `border border-[var(--line)]` is required so the card's `:hover` `border-color` transition (defined in `styles.css`) has a visible border to animate.
- The `--palm` token is the theme-aware green used for the primary buttons; white button text is legible on it in both modes.

- [ ] **Step 2: Format and lint**

Run: `npx biome check --write src/routes/index.tsx`
Expected: file reformatted if needed, reports "No fixes needed" or applies safe fixes, exits 0.

Then run: `npm run check`
Expected: exits 0 (no lint/format errors).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (If `cn` or `ThemeToggle` import paths are wrong, this is where it surfaces.)

- [ ] **Step 4: Build (SSR smoke test)**

Run: `npm run build`
Expected: build completes successfully, no errors. This confirms the route compiles for SSR.

- [ ] **Step 5: Manual visual check**

With `npx convex dev` and `npm run dev` running, open `http://localhost:3000/`:
- Signed out: top-bar "Sign in" + hero "Start planning" both open the Clerk modal.
- Signed in: top-bar shows "Open app" + `UserButton`; hero CTA reads "Go to dashboard" and links to `/dashboard`.
- The three tool cards render (Roadmaps, Diagrams live; AI helper dimmed with a "Soon" badge).
- Click `ThemeToggle` through Light → Dark → Auto: the hero grid, text, cards, and buttons all remain legible in dark mode (no white-on-white or black-on-black).
- No console errors.

- [ ] **Step 6: Offer headline options to the user, then commit**

Before committing, surface 2–3 hero headline options to the user and apply their pick (replace the `<h1>` text). Default is "Design systems, not just slides." Alternatives to offer:
1. "Design systems, not just slides." (default)
2. "Where plans and diagrams share a desk."
3. "The drafting table for software architects."

Then commit:

```bash
git add src/routes/index.tsx
git commit -m "feat(landing): blueprint-inflected ArchStudio landing page"
```

---

## Task 2: README rewrite

**Files:**
- Modify (full rewrite): `README.md`

- [ ] **Step 1: Replace `README.md` with the content below**

```markdown
# ArchStudio

The architect's workbench — roadmaps, diagrams, and more in one place.

ArchStudio is a real-time web app that hosts an architect's planning tools side by side.
Sign in and pick a tool from the Home launcher; everything is real-time, owner-private, and
shareable via read-only links.

## Tools

- **Roadmaps** — a real-time timeline planner. Lay out initiatives across lanes and
  timeframes, drag and resize bars on a zoomable timeline, add per-roadmap custom fields,
  sort them in a table, mark milestones, and share a read-only link. Import/export as JSON.
- **Diagrams** — a live Mermaid + PlantUML editor. Type on the left, see the rendered diagram
  on the right. Mermaid renders in the browser; PlantUML and other engines render via
  [kroki.io](https://kroki.io). Manual version history and read-only share links included.
- **AI helper** _(coming soon)_ — a Claude-powered assistant that will dock into the editors
  to draft diagrams and summarize roadmaps.

## Tech stack

- **Frontend:** React 19 + [TanStack React Start](https://tanstack.com/start) (SSR,
  file-based routing), deployed as a Cloudflare Worker.
- **Backend:** [Convex](https://convex.dev) — serverless, real-time queries and mutations.
- **Auth:** [Clerk](https://clerk.com) (JWT → Convex).
- **Styling:** Tailwind CSS v4 with a CSS-variable design system; light/dark theming.
- **Tooling:** [Biome](https://biomejs.dev) (lint/format), [Vitest](https://vitest.dev) (tests).

For the architecture, data model, and project conventions, see [`CLAUDE.md`](CLAUDE.md).

## Quick start

1. Create `.env.local` with:

   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   CONVEX_DEPLOYMENT=dev:your-deployment
   ```

   (Or run `npx convex init` to set the Convex values automatically.)

2. Run the backend and frontend in **two terminals**:

   ```bash
   npx convex dev   # Convex backend in watch mode — REQUIRED, or useQuery never resolves
   npm run dev      # Vite dev server on http://localhost:3000
   ```

There is no single `dev:all` watch script — the two processes run side by side.

## Commands

```bash
npm run test          # Vitest (all). Single file: npx vitest run src/lib/__tests__/timeline.test.ts
npm run check         # Biome lint + format check — must pass before committing
npx tsc --noEmit      # Full type check (Biome does not type-check)
npm run build         # Production/SSR build (also the best smoke test that the app compiles)
npx convex dev --once # Deploy backend once + typecheck convex/ + regenerate convex/_generated
npm run seed          # Seed demo data (npx convex run seed:seedDemo)
```

## Authentication (Clerk)

1. Create an application at [clerk.com](https://clerk.com) and copy the **Publishable Key**
   into `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`.
2. Create a Clerk **JWT template named `convex`** (required by the Convex ↔ Clerk integration).
3. Set `CLERK_JWT_ISSUER_DOMAIN` on the **Convex** deployment (not in the repo):

   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
   ```

The Clerk provider wraps the Convex provider via `ConvexProviderWithClerk`
(`src/integrations/convex/provider.tsx`).

## Convex

- Set `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT` in `.env.local` (or `npx convex init`).
- Run `npx convex dev` to start the backend in watch mode.
- After editing anything in `convex/`, run `npx convex dev --once` to redeploy, typecheck, and
  regenerate `convex/_generated`. Commit the regenerated output with your change.

## Deploy (Cloudflare Workers)

Each environment is a frontend **build** pointed at its own Convex backend, shipped to a
differently-named Worker. `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` are baked in at
build time — there are no runtime Worker secrets. The deploy scripts deploy **both layers**:
`convex deploy` pushes the backend, then the build runs (injecting that backend's
`VITE_CONVEX_URL`), then `wrangler` ships the Worker.

| Command | Convex deploy | Cloudflare target |
| --- | --- | --- |
| `npm run deploy` | production deployment | Worker `archstudio` |
| `npm run deploy:dev` | dev backend | Worker `archstudio-dev` (`wrangler deploy --env dev`) |
| `npm run deploy:preview` | branch-named preview deployment | ephemeral preview URL (`wrangler versions upload`) |

Orchestration lives in [`scripts/deploy.mjs`](scripts/deploy.mjs); Worker names are in
`wrangler.jsonc`.

### Per-environment credentials

Each command loads `.env.deploy.<env>` via Node's `--env-file`. Create one file per
environment — `.env.deploy.prod`, `.env.deploy.dev`, `.env.deploy.preview` — they are
**gitignored** (`.env.deploy.*`); never commit them. Each contains:

```
# Convex dashboard → Settings → Deploy Keys.
# prod = production key, dev = dev backend key, preview = Preview Deploy Key.
CONVEX_DEPLOY_KEY=
# Clerk Publishable Key for this environment's Clerk instance.
VITE_CLERK_PUBLISHABLE_KEY=
# Optional — omit if you use interactive `wrangler login`.
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

### One-time setup

1. `wrangler login` (or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the deploy files).
2. Create the **prod** Convex deployment and a separate **dev** Convex backend; generate a
   Deploy Key for each. Generate a **Preview Deploy Key** for previews.
3. On **each** Convex deployment, set `CLERK_JWT_ISSUER_DOMAIN` via `npx convex env set`. For
   preview, set it as a default preview env var in the Convex dashboard so ephemeral previews
   inherit it.
4. Fill in each `.env.deploy.<env>` file (keys above).
```

- [ ] **Step 2: Lint-check the docs (sanity) and verify nothing else broke**

Run: `npm run check`
Expected: exits 0. (Biome ignores Markdown content by default but this confirms no `src/` regressions.)

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): rewrite as ArchStudio product README"
```

---

## Task 3: CLAUDE.md update to ArchStudio reality

**Files:**
- Modify: `CLAUDE.md` (intro paragraph, Commands block, Architecture section)

Preserve every existing gotcha and convention verbatim. These are surgical edits.

- [ ] **Step 1: Rewrite the intro paragraph**

Find this paragraph near the top (just under the `# CLAUDE.md` heading and its one-line note):

> A real-time roadmap-planning web app: timelines of initiatives across lanes and timeframes, with per-roadmap custom fields, a sortable table, milestones, public read-only share links, and JSON import/export. Built phase-by-phase from the spec in `docs/superpowers/specs/` and plans in `docs/superpowers/plans/`.

Replace it with:

> ArchStudio is a real-time **architect's workbench**: a multi-tool app where `/dashboard` is a Home launcher and each tool is its own section. Two tools ship today — **Roadmaps** (timelines of initiatives across lanes and timeframes, with per-roadmap custom fields, a sortable table, milestones, public read-only share links, and JSON import/export) and **Diagrams** (a live Mermaid + PlantUML editor with versioning and public share links) — with a Claude-powered AI helper planned. Built phase-by-phase from specs in `docs/superpowers/specs/` and plans in `docs/superpowers/plans/`.

- [ ] **Step 2: Add the `seed` command to the Commands block**

In the second `bash` code block under `## Commands` (the one starting with `npm run test`), add a line after the `npm run build` line:

```bash
npm run seed          # Seed demo data (npx convex run seed:seedDemo)
```

- [ ] **Step 3: Update the "Two layers in one repo" architecture intro**

Find this bullet pair under `## Architecture`:

> Two layers in one repo:
> - **`src/`** — React 19 + TanStack React Start (SSR), file-based routing, deployed as a Cloudflare Worker.
> - **`convex/`** — serverless backend: schema, queries, mutations. Real-time by default.

Immediately after that pair, insert this new paragraph:

> **The app shell.** `/` is a public, standalone landing route (outside `AppShell`). `/dashboard` is the authed Home launcher — a grid of `ToolCard`s. Each tool lives in its own section: Roadmaps at `/roadmaps/` (list) and `/roadmaps/$id` (editor); Diagrams at `/diagrams/` (list) and `/diagrams/$id` (editor). `Sidebar.tsx` / `BottomTabBar.tsx` nav = Home / Roadmaps / Diagrams. `AppShell` gates the authed sections (`<SignedIn>` / `<RedirectToSignIn>`).

- [ ] **Step 4: Add a Diagrams subsystem section**

Find the paragraph that begins **"The editor route"** near the end of `## Architecture` (it starts with "**The editor route** `src/routes/roadmaps/$id.tsx`…"). Immediately **before** that paragraph, insert this new section:

> **The Diagrams tool (mirrors Roadmaps' shape).** `diagrams` + `diagramVersions` Convex tables mirror `roadmaps`/`roadmapVersions`. Mermaid renders **client-side** (dynamic `import("mermaid")`, `securityLevel: "strict"`); PlantUML and future engines render via **kroki.io** — `src/lib/kroki.ts` does deflate + base64url with the browser-native `CompressionStream` (no pako), and the SVG is shown as an `<img>` object URL, never inlined. The engine registry `src/lib/diagramEngines.ts` keys off `DiagramType = Doc<"diagrams">["type"]`, so adding a schema literal forces a matching registry entry. The split-view editor `/diagrams/$id` is CodeMirror 6 on the left and a debounced preview on the right (`useDiagramRender` retains the last good render across transient errors). Source autosaves on a ~1s debounce; versions are manual + auto-before-restore only (same policy as roadmaps). Public share is `/share/diagram/$token` via `sharing.getPublicDiagram` (unauthenticated, mirroring `sharing.getPublicRoadmap`). `VersionManager` was generalized into a `VersionDialog` + thin per-entity wrappers.

- [ ] **Step 5: Verify the edits are coherent and nothing else broke**

Run: `npm run check`
Expected: exits 0.

Re-read the edited `CLAUDE.md` sections to confirm: intro describes the multi-tool workbench; the Commands block lists `npm run seed`; the shell paragraph and Diagrams section are present; all pre-existing gotchas (auth gating, Biome, `--rm-*` non-rename, convex-test excludes, line endings, env) are untouched.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): update to ArchStudio multi-tool reality"
```

---

## Final verification

After all three tasks:

- [ ] `npm run check` — exits 0
- [ ] `npx tsc --noEmit` — exits 0
- [ ] `npm run build` — succeeds
- [ ] `npm run test` — existing Vitest suite green
- [ ] Manual: `/` renders correctly signed-out and signed-in, light and dark, no console errors
- [ ] `git log --oneline` shows the three feature commits on `feature/landing-page-and-docs-refresh`

Then use the `superpowers:finishing-a-development-branch` skill to decide how to integrate (merge to `master` or open a PR).
```

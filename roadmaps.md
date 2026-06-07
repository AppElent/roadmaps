# Roadmaps App — Build Brief

A starting reference for building a **roadmapping application**. Point Claude at this file
(`@roadmaps.md`) when working on the new app. The tech stack, conventions, and architecture
intentionally mirror the existing **workouts** app so the two share the same foundations.

> **Design note:** Visual design / UI styling will be defined by the project owner. This file
> describes structure, stack, and data — not look-and-feel. Do not invent a theme; ask for the
> design or wait for design assets/specs before styling pages.

---

## What we're building

A web app for creating and sharing **product/project roadmaps**: timelines of initiatives and
features organized into lanes, plotted across timeframes (quarters/months), with statuses,
milestones, and dependencies. Multi-user, real-time, auth-gated.

Core user stories (MVP):

- Create a roadmap with a name and a timeframe (e.g. Q1–Q4 2026).
- Add **lanes** (swimlanes) to group items — by team, product, or theme.
- Add **items** (initiatives/features) with a title, start/end date, lane, status, and priority.
- Mark **milestones** at points in time.
- Define **dependencies** between items (X blocks Y).
- View a roadmap as a timeline; filter by status/lane/tag.
- Real-time collaboration: changes appear live for everyone viewing the roadmap.

---

## Tech Stack (identical to the workouts app)

| Layer            | Technology                                        |
| ---------------- | ------------------------------------------------- |
| UI Framework     | React 19 + TanStack React Start (SSR)             |
| Routing          | TanStack Router (file-based, part of React Start) |
| Hosting          | Cloudflare Workers (via Wrangler)                 |
| Backend          | Convex (serverless, real-time)                    |
| Auth             | Clerk                                             |
| Styling          | Tailwind CSS v4 + CVA                             |
| UI Primitives    | Base UI (unstyled, accessible)                    |
| Charts           | Recharts                                          |
| Forms            | TanStack Form + Zod                               |
| Date utilities   | date-fns                                          |
| Icons            | Lucide React                                      |
| Linter/Formatter | Biome                                             |
| Test Runner      | Vitest                                            |

### Architecture

Single codebase split into two layers:

- **`src/`** — React 19 frontend with TanStack React Start (SSR, file-based routing).
- **`convex/`** — Serverless backend: database schema, queries, mutations, actions.

SSR via TanStack React Start, deployed as a Cloudflare Worker. Server entry point is
`@tanstack/react-start/server-entry`. Deployment environments (production, dev) live in
`wrangler.jsonc`. PR previews are provisioned per-PR (per-PR Convex backend + per-PR Worker).

### Data Flow

```
Clerk (auth) → JWT → Convex backend → real-time subscriptions → React components
```

All Convex functions require auth. The Convex client is initialized in
`src/integrations/convex/provider.tsx` and authenticated via Clerk's JWT token
(`convex/auth.config.ts`). The Clerk provider wraps the Convex provider in the component tree.

---

## Commands

```bash
npm run dev:all    # Start both Convex dev server and Vite concurrently (recommended)
npm run dev        # Start Vite dev server only (port 3000, all interfaces)
npm run build      # Production build (Vite)
npm run build:development  # Vite build with --mode development
npm run preview    # Build (dev mode) + start local Cloudflare Workers dev server
npm run test       # Run all tests with Vitest
npm run lint       # Biome linter
npm run format     # Biome formatter
npm run check      # Biome lint + format check combined
npm run deploy           # Production build + deploy to Cloudflare (prod)
npm run deploy:dev       # Dev build + deploy to Cloudflare (dev env)
npm run cf-typegen       # Generate Cloudflare Workers TypeScript types
```

Run a single test file: `npx vitest run src/path/to/test.ts`

- `npm run dev:all` runs `npx convex dev` and `vite dev` concurrently. **Both must be running**
  for full functionality — Convex won't be available with `npm run dev` alone.
- `npm run preview` does a full `build:development` then launches a local Cloudflare Workers dev
  server via `wrangler dev`. It simulates the production Workers runtime locally; env vars are
  injected by Wrangler from `wrangler.jsonc`.

---

## Proposed Backend (Convex)

`convex/schema.ts` defines all tables. Suggested tables for the roadmaps domain:

- **`roadmaps`** — top-level roadmap container.
  - `userId` (owner), `name`, `description?`, `startDate`, `endDate`,
    `timeframeUnit` (`"month"` / `"quarter"`), `visibility` (`"private"` / `"shared"`),
    `archived` (bool).
  - Indexes: by `userId`, by `userId` + `archived`.

- **`lanes`** — swimlanes within a roadmap (teams / products / themes).
  - `roadmapId`, `userId`, `name`, `color?`, `order` (for manual sorting).
  - Indexes: by `roadmapId`.

- **`items`** — the cards plotted on the timeline (initiatives / features / epics).
  - `roadmapId`, `laneId`, `userId`, `title`, `description?`, `startDate`, `endDate`,
    `status` (`"planned"` / `"in_progress"` / `"completed"` / `"blocked"` / `"cancelled"`),
    `priority` (`"low"` / `"medium"` / `"high"`), `progress?` (0–100), `order`.
  - Indexes: by `roadmapId`, by `roadmapId` + `laneId`, by `roadmapId` + `status`.

- **`milestones`** — point-in-time markers on a roadmap.
  - `roadmapId`, `userId`, `name`, `date`, `color?`.
  - Indexes: by `roadmapId`.

- **`dependencies`** — directed links between items.
  - `roadmapId`, `fromItemId`, `toItemId`, `type` (`"blocks"` / `"relates_to"`).
  - Indexes: by `roadmapId`, by `fromItemId`, by `toItemId`.

- **`tags`** — reusable labels; `items` reference them via a `tagIds` array or a join table.
  - `roadmapId`, `userId`, `name`, `color?`.

- **`comments`** — discussion/updates on an item (optional, post-MVP).
  - `roadmapId`, `itemId`, `userId`, `body`, `createdAt`.
  - Indexes: by `itemId`.

Convex API files (mirror the workouts app's one-file-per-domain layout):

- `convex/roadmaps.ts` — list / fetch / create / update / archive roadmaps.
- `convex/lanes.ts` — manage lanes and ordering.
- `convex/items.ts` — CRUD + reorder/move items between lanes.
- `convex/milestones.ts` — manage milestones.
- `convex/dependencies.ts` — create / remove item links.
- `convex/tags.ts` — manage tags.
- `convex/comments.ts` — item discussion (post-MVP).
- `convex/seed.ts` — optional sample roadmap data for new accounts.

`convex/_generated/` is **auto-generated** from the schema — never edit manually.

**Auth:** every Convex function must enforce auth server-side (`ctx.auth.getUserIdentity()`),
scope all reads/writes to the authenticated `userId`, and verify ownership of the parent
`roadmapId` before mutating child rows.

---

## Proposed Routing

Routes live in `src/routes/` using TanStack Router's file-based convention:

```
src/routes/
├── __root.tsx              # Root layout: theme init, providers
├── index.tsx              # Home/landing page
├── dashboard/index.tsx    # List of the user's roadmaps
├── roadmaps/
│   ├── index.tsx          # Roadmap library & creation
│   └── $id.tsx            # Single roadmap view (the timeline; real-time)
├── login/index.tsx        # Login (Clerk)
└── profile/index.tsx      # User profile / settings
```

`src/routeTree.gen.ts` is **auto-generated** by TanStack Router — never edit it manually.

---

## Proposed UI Layout

Reuse the workouts app's shell pattern:

- `src/components/AppShell.tsx` wraps all authenticated pages — `Sidebar` on desktop,
  `BottomTabBar` on mobile. Pages use `pb-16 sm:pb-0` to clear the mobile bottom nav.

Suggested component organization (final visuals TBD by the owner):

```
src/components/
├── AppShell.tsx
├── Sidebar.tsx
├── BottomTabBar.tsx
├── button.tsx                 # Base button component
├── roadmaps/
│   ├── RoadmapCard.tsx        # Card in the roadmap library
│   └── CreateRoadmapForm.tsx
├── timeline/
│   ├── TimelineGrid.tsx       # The time axis + lane rows
│   ├── LaneRow.tsx
│   ├── ItemBar.tsx            # A draggable item bar on the timeline
│   ├── MilestoneMarker.tsx
│   └── DependencyArrow.tsx
└── ui/                        # Base UI primitives
```

---

## Key Conventions (carry over exactly)

- **Linter/formatter:** Biome (not ESLint/Prettier). Tab indentation, double quotes for JS/TS.
- **Styling:** Tailwind CSS v4 + CVA for variants. No CSS modules. Use `cn()` from
  `src/lib/utils.ts` to merge class names.
- **Icons:** Lucide React only. Do not add other icon libraries.
- **Path aliases:** `#/*` and `@/*` both resolve to `src/`. `@convex/*` resolves to `convex/`.
- **Auth guards:** Use Clerk's `<SignedIn>` / `<RedirectToSignIn>` for protected UI. All Convex
  functions enforce auth server-side.
- **Forms:** TanStack Form with Zod schemas for validation.
- **Data fetching:** Convex `useQuery` / `useMutation` hooks for all backend data. The
  `@convex-dev/react-query` adapter is available for TanStack Query integration.
- **Dates:** date-fns for all date math (timeframe ranges, item positioning on the axis).
- **Biome excludes:** `src/routeTree.gen.ts` and `src/styles.css` are excluded from linting — do
  not add lint-disable comments in those files.
- **Tests:** Write Vitest tests for non-trivial logic (date→pixel positioning, dependency cycle
  detection, timeframe bucketing). Run tests before marking work complete.

---

## Environment Variables

| Variable                     | Purpose                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend auth                              |
| `VITE_CONVEX_URL`            | Convex deployment URL for the frontend client                   |
| `environment_name`           | Set by Wrangler: `"production"`, `"development"`, or `"staging"` |

Variable sources by context:

- **Local dev** (`npm run dev:all`): from `.env` / `.env.local`.
- **Local Workers preview** (`npm run preview`): injected by Wrangler from `wrangler.jsonc`.
- **Deployed envs:** in `wrangler.jsonc` under top-level (production) and `[env.dev]`.

The Convex backend reads `CLERK_JWT_ISSUER_DOMAIN` from its own environment (set via
`npx convex env set` or the Convex dashboard), configured in `convex/auth.config.ts`.
`CONVEX_DEPLOYMENT` is written to `.env.local` automatically by `npx convex dev`.

> **Security:** Never commit `.env`. Ensure `.gitignore` covers `.env`, `.env.*`,
> `node_modules/`, `dist/`, `.claude/`. Never hardcode credentials — always use env vars.

---

## Suggested Build Order

1. Scaffold the app with the same stack (TanStack Start + Convex + Clerk + Cloudflare Workers).
2. Wire auth (Clerk) and the Convex provider; confirm an authed query round-trips.
3. Define `convex/schema.ts` (roadmaps → lanes → items → milestones → dependencies → tags).
4. Build `roadmaps.ts` + `lanes.ts` + `items.ts` queries/mutations with auth + ownership checks.
5. Build the dashboard (roadmap list) and roadmap creation form.
6. Build the timeline view (`$id.tsx`): time axis, lanes, item bars (read-only first).
7. Add create/edit/move/resize for items; then milestones, dependencies, tags.
8. Add real-time polish and filters (status/lane/tag).
9. Apply the owner-provided design once structure works.

---

## MVP vs. Later

- **MVP:** roadmaps, lanes, items, milestones, timeline view, basic create/edit, real-time.
- **Later:** dependencies + arrows, drag-to-reschedule, tags/filtering, comments, sharing /
  permissions, export (PNG/PDF/CSV), templates, Recharts-based progress reporting.

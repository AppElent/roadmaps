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

The app ships as two layers: the Convex backend and a Cloudflare Worker that serves the SSR
frontend. `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` are read from the environment at
**build time** (there are no runtime Worker secrets), so each build is pinned to the backend it
was built against.

| Command | What it runs | Worker |
| --- | --- | --- |
| `npm run deploy` | `convex deploy` → `vite build` → `wrangler deploy` | `archstudio` (production) |
| `npm run deploy:dev` | `convex dev --once` → `vite build --mode development` → `wrangler deploy --env dev` | `archstudio-dev` |
| `npm run deploy:preview` | `convex dev --once` → `vite build --mode development` → `wrangler deploy --env preview` | preview env — see note |

Worker names live in `wrangler.jsonc` (`name: "archstudio"`, `env.dev.name: "archstudio-dev"`).

> **Note:** `npm run deploy:preview` targets `--env preview`, which is not yet defined in
> `wrangler.jsonc`. Add an `env.preview` block there before using it.

### One-time setup

1. `wrangler login` (or provide `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the environment).
2. Create the production Convex deployment (the target of `npx convex deploy`) and a separate dev
   backend for `deploy:dev`.
3. On **each** Convex deployment, set `CLERK_JWT_ISSUER_DOMAIN` via `npx convex env set`.
4. Provide `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` for the build (e.g. in `.env.local`),
   so the bundle points at the right backend and Clerk instance.

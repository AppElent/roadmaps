# Roadmaps Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the raw scaffold into an authenticated, test-ready base where a signed-in user's Convex query round-trips, and the demo code is gone.

**Architecture:** Wire Clerk → Convex auth with `ConvexProviderWithClerk` and `auth.config.ts`. Add a `@convex/*` path alias and a standalone Vitest config. Add a server-side `requireUser` auth helper. Remove all scaffold demo routes/components and reset the schema.

**Tech Stack:** TanStack Start, Convex, Clerk (`@clerk/clerk-react`, `convex/react-clerk`), Vitest, Biome.

---

## File structure for this phase

- Modify: `tsconfig.json` — add `@convex/*` alias
- Create: `vitest.config.ts` — test runner config with aliases + react plugin
- Create: `convex/auth.config.ts` — Clerk JWT provider for Convex
- Create: `convex/lib/auth.ts` — `requireUser` helper
- Create: `convex/users.ts` — authed `me` query (round-trip probe)
- Modify: `convex/schema.ts` — reset to empty (Phase 1 fills it)
- Modify: `src/integrations/convex/provider.tsx` — use `ConvexProviderWithClerk`
- Delete: demo routes/components/convex (listed in Task 6)
- Create: `src/lib/__tests__/sanity.test.ts` — confirms Vitest runs

---

### Task 1: Add `@convex/*` alias and Vitest config

**Files:**
- Modify: `tsconfig.json:7-10`
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/sanity.test.ts`

- [ ] **Step 1: Add the `@convex/*` path alias**

In `tsconfig.json`, replace the `paths` block:

```json
"paths": {
  "#/*": ["./src/*"],
  "@/*": ["./src/*"],
  "@convex/*": ["./convex/*"]
},
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`. It deliberately does **not** load the Cloudflare/TanStack-Start plugins (they break the test runner); it resolves the same aliases manually and adds the React plugin for component tests.

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		globals: false,
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"#": fileURLToPath(new URL("./src", import.meta.url)),
			"@convex": fileURLToPath(new URL("./convex", import.meta.url)),
		},
	},
});
```

Component tests opt into the DOM with a top-of-file docblock: `// @vitest-environment jsdom`.

- [ ] **Step 3: Write a sanity test**

Create `src/lib/__tests__/sanity.test.ts`:

```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
	expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Run it to verify the runner works**

Run: `npm run test`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json vitest.config.ts src/lib/__tests__/sanity.test.ts
git commit -m "chore: add @convex alias and vitest config"
```

---

### Task 2: Convex auth config

**Files:**
- Create: `convex/auth.config.ts`

- [ ] **Step 1: Create `convex/auth.config.ts`**

```ts
export default {
	providers: [
		{
			domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
			applicationID: "convex",
		},
	],
};
```

- [ ] **Step 2: Manual Clerk + Convex setup (one-time, document in commit body)**

1. In the Clerk dashboard → **JWT Templates** → create a template named exactly `convex`.
2. Copy the template's **Issuer** URL (e.g. `https://calm-cricket-82.clerk.accounts.dev`).
3. Set it on the Convex backend: `npx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer-url>`

- [ ] **Step 3: Push to Convex and verify it loads**

Run: `npx convex dev --once`
Expected: deploy succeeds with no auth-config error.

- [ ] **Step 4: Commit**

```bash
git add convex/auth.config.ts
git commit -m "feat: configure Clerk JWT provider for Convex"
```

---

### Task 3: Server-side auth helper

**Files:**
- Create: `convex/lib/auth.ts`

- [ ] **Step 1: Create `convex/lib/auth.ts`**

`requireUser` returns the Clerk subject (the stable user id we store as `userId`). `requireRoadmapOwner` is added in Phase 1 once the `roadmaps` table exists.

```ts
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Returns the authenticated user's id (Clerk subject), or throws. */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Not authenticated");
	}
	return identity.subject;
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/lib/auth.ts
git commit -m "feat: add requireUser auth helper"
```

---

### Task 4: Authed probe query

**Files:**
- Create: `convex/users.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Reset the schema to empty**

Replace `convex/schema.ts` entirely (Phase 1 populates it):

```ts
import { defineSchema } from "convex/server";

export default defineSchema({});
```

- [ ] **Step 2: Create `convex/users.ts`**

```ts
import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";

/** Round-trip probe: returns the caller's id, or throws if unauthenticated. */
export const me = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		return { userId };
	},
});
```

- [ ] **Step 3: Regenerate Convex types**

Run: `npx convex dev --once`
Expected: `convex/_generated/api.d.ts` now includes `users.me`.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat: add authed me query probe"
```

---

### Task 5: Wire ConvexProviderWithClerk

**Files:**
- Modify: `src/integrations/convex/provider.tsx`

- [ ] **Step 1: Replace the provider**

```tsx
import { useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
	console.error("missing envar VITE_CONVEX_URL");
}
const convexQueryClient = new ConvexQueryClient(CONVEX_URL);

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ConvexProviderWithClerk
			client={convexQueryClient.convexClient}
			useAuth={useAuth}
		>
			{children}
		</ConvexProviderWithClerk>
	);
}
```

`__root.tsx` already nests `<ConvexProvider>` inside `<ClerkProvider>`, so `useAuth` resolves correctly. No change needed there yet.

- [ ] **Step 2: Commit**

```bash
git add src/integrations/convex/provider.tsx
git commit -m "feat: authenticate Convex client via Clerk"
```

---

### Task 6: Remove scaffold demo code

**Files (delete):**
- `src/routes/demo/clerk.tsx`, `src/routes/demo/convex.tsx`, `src/routes/demo/form.address.tsx`, `src/routes/demo/form.simple.tsx`, `src/routes/demo/tanstack-query.tsx`
- `src/routes/about.tsx`
- `src/components/demo.FormComponents.tsx`
- `src/hooks/demo.form-context.ts`, `src/hooks/demo.form.ts`
- `convex/todos.ts`

- [ ] **Step 1: Delete the files**

```bash
git rm src/routes/demo/clerk.tsx src/routes/demo/convex.tsx \
  src/routes/demo/form.address.tsx src/routes/demo/form.simple.tsx \
  src/routes/demo/tanstack-query.tsx src/routes/about.tsx \
  src/components/demo.FormComponents.tsx \
  src/hooks/demo.form-context.ts src/hooks/demo.form.ts \
  convex/todos.ts
```

- [ ] **Step 2: Remove demo links from the Header**

Open `src/components/Header.tsx`. Remove any `<Link>` entries pointing at `/demo/*` or `/about`. Leave the brand and any auth/user controls.

- [ ] **Step 3: Regenerate the route tree and confirm the app builds**

Run: `npm run dev` (then stop it after it boots) — or `npx tsr generate`
Expected: `src/routeTree.gen.ts` regenerates with no references to deleted routes; no TypeScript errors about missing demo modules.

- [ ] **Step 4: Lint/format and commit**

```bash
npm run check
git add -A
git commit -m "chore: remove scaffold demo routes and components"
```

---

### Task 7: Verify the authed round-trip (manual)

- [ ] **Step 1: Start both servers**

Run: `npm run dev:all`

- [ ] **Step 2: Confirm the probe works**

Sign in through Clerk in the running app, then in the browser devtools console (or a temporary component) call `api.users.me`. Expected: it resolves to `{ userId: "user_…" }` when signed in, and throws `Not authenticated` when signed out.

Acceptance for Phase 0: signed-in `users.me` returns the user id; demo code is gone; `npm run test` and `npm run check` pass.

---

## Self-review notes

- No automated test for `requireUser` here — it needs `convex-test`, which is installed in Phase 1. Phase 0's auth proof is the manual round-trip, which is appropriate for wiring-only work.
- `requireRoadmapOwner` is intentionally deferred to Phase 1 (depends on the `roadmaps` table).

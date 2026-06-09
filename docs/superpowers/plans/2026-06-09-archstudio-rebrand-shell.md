# ArchStudio Rebrand + Multi-Tool Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product from "Roadmaps" to "ArchStudio" and restructure the app shell into a multi-tool studio (Home launcher + per-tool sections), with Roadmaps as the first tool and Diagrams as a "coming soon" placeholder.

**Architecture:** Frontend-only change. Repurpose `/dashboard` as a Home launcher of tool cards; move the existing roadmaps list to a new `/roadmaps/` index route; add a `/diagrams/` placeholder route; update the brand strings and shell navigation. No Convex/backend changes. A new presentational `ToolCard` component follows the existing `RoadmapCard` pattern (callback-based, no router dependency) so it is unit-testable.

**Tech Stack:** React 19, TanStack React Start (file-based routing), Convex (unchanged), Clerk, Tailwind v4, Biome (tabs + double quotes), Vitest + Testing Library, Lucide icons.

---

## File Structure

- `src/components/ToolCard.tsx` (new) — presentational tool card for the Home launcher.
- `src/components/__tests__/ToolCard.test.tsx` (new) — jsdom component test.
- `src/routes/dashboard/index.tsx` (modify) — becomes the Home launcher.
- `src/routes/roadmaps/index.tsx` (new) — the relocated roadmaps list page.
- `src/routes/diagrams/index.tsx` (new) — placeholder "coming soon" page.
- `src/components/Sidebar.tsx` (modify) — brand + 3 nav entries.
- `src/components/BottomTabBar.tsx` (modify) — 3 nav entries.
- `src/routes/index.tsx` (modify) — landing brand + tagline.
- `src/routes/__root.tsx` (modify) — `<title>`.
- `package.json` (modify) — package name.
- `src/routeTree.gen.ts` (auto-regenerated) — commit alongside.

A note on commits: every commit message in this plan ends with the trailer line:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Run `npm run check` (Biome) before each commit; it enforces tab indentation and double quotes.

---

## Task 1: ToolCard component (TDD)

**Files:**
- Create: `src/components/ToolCard.tsx`
- Test: `src/components/__tests__/ToolCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ToolCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Map } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ToolCard } from "../ToolCard";

describe("ToolCard", () => {
	it("renders title and description", () => {
		render(
			<ToolCard
				title="Roadmaps"
				description="Plan initiatives across lanes and timeframes."
				icon={Map}
				status="active"
				onOpen={() => {}}
			/>,
		);
		expect(screen.getByText("Roadmaps")).toBeDefined();
		expect(
			screen.getByText("Plan initiatives across lanes and timeframes."),
		).toBeDefined();
	});

	it("calls onOpen when an active card is clicked", () => {
		const onOpen = vi.fn();
		render(
			<ToolCard
				title="Roadmaps"
				description="desc"
				icon={Map}
				status="active"
				onOpen={onOpen}
			/>,
		);
		screen.getByRole("button", { name: /Roadmaps/i }).click();
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it("shows a Soon badge and is not clickable when status is soon", () => {
		const onOpen = vi.fn();
		render(
			<ToolCard
				title="Diagrams"
				description="desc"
				icon={Map}
				status="soon"
				onOpen={onOpen}
			/>,
		);
		expect(screen.getByText(/soon/i)).toBeDefined();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/ToolCard.test.tsx`
Expected: FAIL — cannot resolve `../ToolCard` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/ToolCard.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolCardProps {
	title: string;
	description: string;
	icon: LucideIcon;
	status: "active" | "soon";
	onOpen?: () => void;
}

export function ToolCard({
	title,
	description,
	icon: Icon,
	status,
	onOpen,
}: ToolCardProps) {
	const inner = (
		<>
			<div className="flex items-center gap-2">
				<div className="grid size-8 place-items-center rounded-md border border-neutral-200 text-neutral-700">
					<Icon size={16} />
				</div>
				<strong className="text-sm">{title}</strong>
				{status === "soon" && (
					<span className="ml-auto rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
						Soon
					</span>
				)}
			</div>
			<p className="mt-1 text-xs text-neutral-500">{description}</p>
		</>
	);

	if (status === "soon") {
		return (
			<div
				className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4 opacity-60"
				aria-disabled="true"
			>
				{inner}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={onOpen}
			className={cn(
				"flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4 text-left hover:border-neutral-400",
			)}
		>
			{inner}
		</button>
	);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/ToolCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint and commit**

```bash
npm run check
git add src/components/ToolCard.tsx src/components/__tests__/ToolCard.test.tsx
git commit -m "feat: add ToolCard component for tool launcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Relocate the roadmaps list to `/roadmaps/`

Move the existing dashboard body (the roadmaps list) into a new `/roadmaps/` index route, unchanged in behavior. The editor route `src/routes/roadmaps/$id.tsx` is untouched.

**Files:**
- Create: `src/routes/roadmaps/index.tsx`

- [ ] **Step 1: Create the roadmaps index route**

Create `src/routes/roadmaps/index.tsx` (this is the current `dashboard/index.tsx` body with the route id changed and the header copy adjusted):

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AppShell } from "@/components/AppShell";
import { CreateRoadmapDialog } from "@/components/roadmaps/CreateRoadmapDialog";
import { RoadmapCard } from "@/components/roadmaps/RoadmapCard";

export const Route = createFileRoute("/roadmaps/")({
	ssr: false,
	component: RoadmapsPage,
});

function RoadmapsPage() {
	const navigate = useNavigate();
	const roadmaps = useQuery(api.roadmaps.list);
	const create = useMutation(api.roadmaps.create);
	const duplicate = useMutation(api.roadmaps.duplicate);
	const archive = useMutation(api.roadmaps.archive);

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6 flex items-center justify-between">
					<div>
						<p className="rm-label">Roadmaps</p>
						<h1 className="text-2xl font-semibold">Your roadmaps</h1>
					</div>
					<CreateRoadmapDialog
						onCreate={async (input) => {
							const id = await create(input);
							await navigate({ to: "/roadmaps/$id", params: { id } });
						}}
					/>
				</header>

				{roadmaps === undefined ? (
					<p className="text-sm text-neutral-500">Loading…</p>
				) : roadmaps.length === 0 ? (
					<p className="text-sm text-neutral-500">
						No roadmaps yet. Create your first one.
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{roadmaps.map((r) => (
							<RoadmapCard
								key={r._id}
								name={r.name}
								itemCount={r.itemCount}
								updatedLabel={new Date(r._creationTime).toLocaleDateString()}
								onOpen={() =>
									navigate({ to: "/roadmaps/$id", params: { id: r._id } })
								}
								onDuplicate={async () => {
									await duplicate({ roadmapId: r._id as Id<"roadmaps"> });
								}}
								onArchive={async () => {
									await archive({ roadmapId: r._id, archived: true });
								}}
							/>
						))}
					</div>
				)}
			</div>
		</AppShell>
	);
}
```

- [ ] **Step 2: Regenerate the route tree and typecheck**

Run: `npx tsr generate` then `npx tsc --noEmit`
Expected: `src/routeTree.gen.ts` updates to include `/roadmaps/`; tsc passes with no errors.

- [ ] **Step 3: Lint and commit**

```bash
npm run check
git add src/routes/roadmaps/index.tsx src/routeTree.gen.ts
git commit -m "feat: add /roadmaps list route (relocated from dashboard)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Repurpose `/dashboard` as the Home launcher

Replace the dashboard's roadmaps list with a launcher grid of `ToolCard`s.

**Files:**
- Modify: `src/routes/dashboard/index.tsx`

- [ ] **Step 1: Replace the dashboard contents**

Overwrite `src/routes/dashboard/index.tsx` with:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Map, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ToolCard } from "@/components/ToolCard";

export const Route = createFileRoute("/dashboard/")({
	ssr: false,
	component: HomePage,
});

function HomePage() {
	const navigate = useNavigate();

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6">
					<p className="rm-label">Workspace</p>
					<h1 className="text-2xl font-semibold">ArchStudio</h1>
					<p className="mt-1 text-sm text-neutral-500">
						The architect's workbench. Pick a tool to get started.
					</p>
				</header>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<ToolCard
						title="Roadmaps"
						description="Plan initiatives across lanes and timeframes, in real time."
						icon={Map}
						status="active"
						onOpen={() => navigate({ to: "/roadmaps" })}
					/>
					<ToolCard
						title="Diagrams"
						description="Live Mermaid and PlantUML editing."
						icon={Workflow}
						status="soon"
					/>
				</div>
			</div>
		</AppShell>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint and commit**

```bash
npm run check
git add src/routes/dashboard/index.tsx
git commit -m "feat: turn dashboard into the ArchStudio Home launcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Diagrams placeholder route

**Files:**
- Create: `src/routes/diagrams/index.tsx`

- [ ] **Step 1: Create the placeholder route**

Create `src/routes/diagrams/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/diagrams/")({
	ssr: false,
	component: DiagramsPage,
});

function DiagramsPage() {
	return (
		<AppShell>
			<div className="grid min-h-[60vh] place-items-center p-6">
				<div className="max-w-sm text-center">
					<div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg border border-neutral-200 text-neutral-500">
						<Workflow size={20} />
					</div>
					<h1 className="mb-1 text-lg font-semibold">Diagrams are coming soon</h1>
					<p className="text-sm text-neutral-500">
						Live Mermaid and PlantUML editing will live here.
					</p>
				</div>
			</div>
		</AppShell>
	);
}
```

- [ ] **Step 2: Regenerate routes and typecheck**

Run: `npx tsr generate` then `npx tsc --noEmit`
Expected: route tree includes `/diagrams/`; tsc passes.

- [ ] **Step 3: Lint and commit**

```bash
npm run check
git add src/routes/diagrams/index.tsx src/routeTree.gen.ts
git commit -m "feat: add diagrams placeholder route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Update shell navigation (Sidebar + BottomTabBar)

Rebrand the sidebar and give both nav surfaces three entries: Home, Roadmaps, Diagrams.

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Update the Sidebar**

Overwrite `src/components/Sidebar.tsx`:

```tsx
import { UserButton } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { Home, Map, Workflow } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const navLinkClass =
	"flex items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100 [&.active]:bg-neutral-100 [&.active]:text-neutral-900";

export function Sidebar() {
	return (
		<aside className="hidden w-60 flex-col gap-4 border-r border-neutral-200 bg-white p-4 sm:flex">
			<div className="flex items-center gap-2 border-b border-neutral-200 px-1 pb-3">
				<div className="grid size-7 place-items-center rounded-md border border-neutral-900 font-mono text-xs font-bold">
					AS
				</div>
				<strong className="text-sm">ArchStudio</strong>
			</div>
			<nav className="flex flex-col gap-1">
				<Link to="/dashboard" className={navLinkClass}>
					<Home size={16} /> Home
				</Link>
				<Link to="/roadmaps" className={navLinkClass}>
					<Map size={16} /> Roadmaps
				</Link>
				<Link to="/diagrams" className={navLinkClass}>
					<Workflow size={16} /> Diagrams
					<span className="ml-auto rounded-full border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
						Soon
					</span>
				</Link>
			</nav>
			<div className="mt-auto flex items-center gap-2 px-1">
				<UserButton />
				<span className="rm-label">Account</span>
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</div>
		</aside>
	);
}
```

- [ ] **Step 2: Update the BottomTabBar**

Overwrite `src/components/BottomTabBar.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { Home, Map, Workflow } from "lucide-react";

const tabClass =
	"flex flex-col items-center gap-1 text-xs text-neutral-500 [&.active]:text-neutral-900";

export function BottomTabBar() {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-neutral-200 bg-white sm:hidden">
			<Link to="/dashboard" className={tabClass}>
				<Home size={20} /> Home
			</Link>
			<Link to="/roadmaps" className={tabClass}>
				<Map size={20} /> Roadmaps
			</Link>
			<Link to="/diagrams" className={tabClass}>
				<Workflow size={20} /> Diagrams
			</Link>
		</nav>
	);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (route strings `/dashboard`, `/roadmaps`, `/diagrams` all resolve against the regenerated route tree).

- [ ] **Step 4: Lint and commit**

```bash
npm run check
git add src/components/Sidebar.tsx src/components/BottomTabBar.tsx
git commit -m "feat: ArchStudio shell nav with Home/Roadmaps/Diagrams

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Rebrand landing, root title, and package name

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/__root.tsx:31` (the `title` meta)
- Modify: `package.json:2` (the `name` field)

- [ ] **Step 1: Update the landing page**

In `src/routes/index.tsx`, replace the logo, heading, and tagline block. Change the logo text `RM` → `AS`, the `<h1>` text `Roadmaps` → `ArchStudio`, and the `<p>` tagline. The replaced block:

```tsx
				<div className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-neutral-900 font-mono text-sm font-bold">
					AS
				</div>
				<h1 className="mb-2 text-3xl font-semibold tracking-tight">
					ArchStudio
				</h1>
				<p className="mb-6 text-sm text-neutral-500">
					The architect's workbench — roadmaps, diagrams, and more in one place.
				</p>
```

- [ ] **Step 2: Update the root `<title>`**

In `src/routes/__root.tsx`, change the head meta title:

```tsx
				{
					title: "ArchStudio",
				},
```

- [ ] **Step 3: Update the package name**

In `package.json`, change line 2:

```json
  "name": "archstudio",
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run check`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx src/routes/__root.tsx package.json
git commit -m "feat: rebrand Roadmaps to ArchStudio (landing, title, package)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `ToolCard` tests; existing `src/lib/__tests__/*` suites unchanged and green.

- [ ] **Step 2: Typecheck and lint the whole project**

Run: `npx tsc --noEmit` then `npm run check`
Expected: both PASS with no errors.

- [ ] **Step 3: Production build smoke test**

Run: `npm run build`
Expected: SSR build completes with no errors.

- [ ] **Step 4: Manual walkthrough**

In two terminals: `npx convex dev` and `npm run dev`. Then verify:
- `/` shows "ArchStudio" branding and the new tagline.
- Signed in, `/dashboard` shows the Home launcher with a clickable Roadmaps card and a dimmed Diagrams ("Soon") card.
- Clicking Roadmaps → `/roadmaps` list; "Create" → opens an editor at `/roadmaps/$id`.
- `/diagrams` shows the "coming soon" placeholder.
- Sidebar (desktop) and bottom tab bar (mobile width) switch between Home / Roadmaps / Diagrams, with the active item highlighted.

- [ ] **Step 5: Final commit (if the route tree or any formatting changed during verification)**

```bash
git add -A
git commit -m "chore: ArchStudio rebrand verification fixups

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(Skip this commit if `git status` is clean.)

---

## Notes for the implementer

- **Do not** rename the `--rm-*` CSS variables or `rm-btn-primary` / `rm-panel` / `rm-label` classes — they are roadmap-internal and out of scope (see the spec).
- **Do not** edit `src/routeTree.gen.ts` by hand — it regenerates via `npx tsr generate` (or `npm run dev`). Commit the regenerated output with the task that caused it.
- No Convex/backend files change in this plan.

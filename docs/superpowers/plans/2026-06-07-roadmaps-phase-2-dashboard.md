# Roadmaps Phase 2 — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An authenticated app shell and a roadmap library where users create, open, duplicate, and archive roadmaps.

**Architecture:** `AppShell` provides the desktop sidebar + mobile bottom tab bar and gates content behind Clerk auth. `dashboard/index.tsx` lists roadmaps via `api.roadmaps.list` and opens a `CreateRoadmapDialog` (TanStack Form + Zod) that calls `api.roadmaps.create`, then navigates to the new roadmap.

**Tech Stack:** TanStack Router, Convex `useQuery`/`useMutation`, Clerk (`SignedIn`/`RedirectToSignIn`), TanStack Form + Zod, `radix-ui` Dialog, Lucide.

**Depends on:** Phases 0–1.

---

## File structure for this phase

- Modify: `src/routes/__root.tsx` — drop demo `Header`/`Footer`, render only providers + children
- Create: `src/components/AppShell.tsx` — auth gate + sidebar/bottom-nav layout
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/routes/dashboard/index.tsx` — the library page
- Create: `src/components/roadmaps/RoadmapCard.tsx`
- Create: `src/components/roadmaps/CreateRoadmapDialog.tsx`
- Create: `src/components/roadmaps/__tests__/RoadmapCard.test.tsx`

---

### Task 1: Strip the demo shell from the root

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Render only providers + children**

In `RootDocument`, remove the `<Header />` and `<Footer />` elements (and their imports at the top). The `<body>` should render `<ClerkProvider><ConvexProvider>{children}<TanStackDevtools …/></ConvexProvider></ClerkProvider>`. Also change the `title` meta from `"TanStack Start Starter"` to `"Roadmaps"`.

- [ ] **Step 2: Delete the now-unused demo components**

```bash
git rm src/components/Header.tsx src/components/Footer.tsx
```

- [ ] **Step 3: Verify build**

Run: `npm run dev` (boot, then stop). Expected: no missing-import errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: reduce root to providers and outlet"
```

---

### Task 2: App shell with auth gate

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/components/AppShell.tsx`

- [ ] **Step 1: Create `src/components/Sidebar.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { UserButton } from "@clerk/clerk-react";
import { LayoutDashboard, Map } from "lucide-react";

export function Sidebar() {
	return (
		<aside className="hidden sm:flex w-60 flex-col gap-4 border-r border-neutral-200 bg-white p-4">
			<div className="flex items-center gap-2 px-1 pb-3 border-b border-neutral-200">
				<div className="grid size-7 place-items-center rounded-md border border-neutral-900 font-mono text-xs font-bold">
					RM
				</div>
				<strong className="text-sm">Roadmaps</strong>
			</div>
			<nav className="flex flex-col gap-1">
				<Link
					to="/dashboard"
					className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100 [&.active]:bg-neutral-100 [&.active]:text-neutral-900"
				>
					<LayoutDashboard size={16} /> Dashboard
				</Link>
			</nav>
			<div className="mt-auto flex items-center gap-2 px-1">
				<UserButton />
				<span className="font-mono text-xs text-neutral-500">Account</span>
				<Map size={14} className="ml-auto text-neutral-300" />
			</div>
		</aside>
	);
}
```

- [ ] **Step 2: Create `src/components/BottomTabBar.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

export function BottomTabBar() {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-neutral-200 bg-white sm:hidden">
			<Link
				to="/dashboard"
				className="flex flex-col items-center gap-1 text-xs text-neutral-500 [&.active]:text-neutral-900"
			>
				<LayoutDashboard size={20} /> Dashboard
			</Link>
		</nav>
	);
}
```

- [ ] **Step 3: Create `src/components/AppShell.tsx`**

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { BottomTabBar } from "./BottomTabBar";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SignedIn>
				<div className="flex min-h-screen bg-neutral-50 text-neutral-900">
					<Sidebar />
					<main className="min-w-0 flex-1 pb-16 sm:pb-0">{children}</main>
					<BottomTabBar />
				</div>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/BottomTabBar.tsx src/components/AppShell.tsx
git commit -m "feat: authenticated app shell"
```

---

### Task 3: RoadmapCard (TDD render)

**Files:**
- Create: `src/components/roadmaps/RoadmapCard.tsx`
- Create: `src/components/roadmaps/__tests__/RoadmapCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/roadmaps/__tests__/RoadmapCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { RoadmapCard } from "../RoadmapCard";

test("renders the roadmap name and item count", () => {
	render(
		<RoadmapCard
			name="Platform"
			itemCount={12}
			updatedLabel="today"
			onOpen={vi.fn()}
			onDuplicate={vi.fn()}
			onArchive={vi.fn()}
		/>,
	);
	expect(screen.getByText("Platform")).toBeTruthy();
	expect(screen.getByText(/12 items/)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/roadmaps/__tests__/RoadmapCard.test.tsx`
Expected: FAIL — cannot find `../RoadmapCard`.

- [ ] **Step 3: Implement `src/components/roadmaps/RoadmapCard.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { Archive, Copy } from "lucide-react";

export interface RoadmapCardProps {
	name: string;
	itemCount: number;
	updatedLabel: string;
	className?: string;
	onOpen: () => void;
	onDuplicate: () => void;
	onArchive: () => void;
}

export function RoadmapCard({
	name,
	itemCount,
	updatedLabel,
	className,
	onOpen,
	onDuplicate,
	onArchive,
}: RoadmapCardProps) {
	return (
		<div
			className={cn(
				"group flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400",
				className,
			)}
		>
			<button type="button" onClick={onOpen} className="text-left">
				<strong className="text-sm">{name}</strong>
				<p className="mt-1 font-mono text-xs text-neutral-500">
					updated {updatedLabel} / {itemCount} items
				</p>
			</button>
			<div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
				<button
					type="button"
					onClick={onDuplicate}
					className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs"
				>
					<Copy size={12} /> Duplicate
				</button>
				<button
					type="button"
					onClick={onArchive}
					className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs"
				>
					<Archive size={12} /> Archive
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/roadmaps/__tests__/RoadmapCard.test.tsx`
Expected: PASS.

> If `toBeTruthy` on DOM nodes needs jest-dom matchers, they are not required here — `getByText` throws if missing, so the assertions hold with plain Vitest.

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmaps/RoadmapCard.tsx src/components/roadmaps/__tests__/RoadmapCard.test.tsx
git commit -m "feat: roadmap card component"
```

---

### Task 4: CreateRoadmapDialog (TanStack Form + Zod)

**Files:**
- Create: `src/components/roadmaps/CreateRoadmapDialog.tsx`

- [ ] **Step 1: Implement the dialog**

```tsx
import { useState } from "react";
import { Dialog } from "radix-ui";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const schema = z
	.object({
		name: z.string().min(1, "Name is required"),
		startDate: z.string().min(1, "Start is required"),
		endDate: z.string().min(1, "End is required"),
	})
	.refine((v) => new Date(v.endDate) > new Date(v.startDate), {
		message: "End must be after start",
		path: ["endDate"],
	});

export interface CreateRoadmapDialogProps {
	onCreate: (input: {
		name: string;
		startDate: number;
		endDate: number;
	}) => Promise<void>;
}

export function CreateRoadmapDialog({ onCreate }: CreateRoadmapDialogProps) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { name: "", startDate: "", endDate: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			await onCreate({
				name: value.name,
				startDate: new Date(value.startDate).getTime(),
				endDate: new Date(value.endDate).getTime(),
			});
			setOpen(false);
			form.reset();
		},
	});

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white">
				New roadmap
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">New roadmap</Dialog.Title>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="mt-4 flex flex-col gap-3"
					>
						<form.Field name="name">
							{(field) => (
								<label className="flex flex-col gap-1 text-sm">
									Name
									<input
										className="rounded-md border border-neutral-200 px-2 py-2"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors[0] ? (
										<span className="text-xs text-red-600">
											{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}
										</span>
									) : null}
								</label>
							)}
						</form.Field>
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="startDate">
								{(field) => (
									<label className="flex flex-col gap-1 text-sm">
										Start
										<input
											type="date"
											className="rounded-md border border-neutral-200 px-2 py-2"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</label>
								)}
							</form.Field>
							<form.Field name="endDate">
								{(field) => (
									<label className="flex flex-col gap-1 text-sm">
										End
										<input
											type="date"
											className="rounded-md border border-neutral-200 px-2 py-2"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{field.state.meta.errors[0] ? (
											<span className="text-xs text-red-600">
												{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}
											</span>
										) : null}
									</label>
								)}
							</form.Field>
						</div>
						<button
							type="submit"
							className="mt-2 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
						>
							Create
						</button>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `radix-ui`'s `Dialog` named export differs in the installed version, import via `import * as Dialog from "@radix-ui/react-dialog"` — confirm with `npm ls radix-ui`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/roadmaps/CreateRoadmapDialog.tsx
git commit -m "feat: create-roadmap dialog with validation"
```

---

### Task 5: Dashboard route

**Files:**
- Create: `src/routes/dashboard/index.tsx`

- [ ] **Step 1: Implement the route**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { CreateRoadmapDialog } from "@/components/roadmaps/CreateRoadmapDialog";
import { RoadmapCard } from "@/components/roadmaps/RoadmapCard";

export const Route = createFileRoute("/dashboard/")({
	ssr: false,
	component: DashboardPage,
});

function DashboardPage() {
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
						<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
							Workspace
						</p>
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
								itemCount={0}
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

> `itemCount` is shown as `0` until Phase 3 wires per-roadmap counts; a follow-up in Phase 6 can add a count to `roadmaps.list`. This is a known placeholder value, not a placeholder instruction.

- [ ] **Step 2: Add a redirect from `/` to `/dashboard` (optional landing)**

In `src/routes/index.tsx`, replace the component body with a redirect for signed-in users, or leave the landing page and add a "Go to dashboard" link. Minimal version: render a link to `/dashboard`.

- [ ] **Step 3: Verify manually**

Run: `npm run dev:all`. Sign in, create a roadmap, confirm it appears, opens (route renders Phase 3's view later — for now `/roadmaps/$id` may 404 until Phase 3), duplicate adds a copy, archive removes it from the list.

- [ ] **Step 4: Lint + commit**

```bash
npm run check
git add src/routes/dashboard/index.tsx src/routes/index.tsx
git commit -m "feat: roadmap dashboard library"
```

---

## Self-review notes

- **Spec coverage:** dashboard library (§5 routes), create/duplicate/archive (§4), auth gate (§2) ✓. `roadmaps/$id` view is Phase 3.
- **Type consistency:** `create` returns `Id<"roadmaps">`; navigation uses `params: { id }`. `RoadmapCard` props match call sites.
- **Known deferred value:** `itemCount={0}` until counts are added to `roadmaps.list` (Phase 6 follow-up).

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { FieldManager } from "@/components/fields/FieldManager";
import { FilterBar } from "@/components/filters/FilterBar";
import { ImportExportDialog } from "@/components/io/ImportExportDialog";
import { LaneManager } from "@/components/lanes/LaneManager";
import { MilestoneManager } from "@/components/milestones/MilestoneManager";
import { ItemEditorPanel } from "@/components/panel/ItemEditorPanel";
import { RoadmapSettingsDialog } from "@/components/roadmaps/RoadmapSettingsDialog";
import { ShareDialog } from "@/components/share/ShareDialog";
import { ItemTable } from "@/components/table/ItemTable";
import { TimelineView } from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
import { VersionManager } from "@/components/versions/VersionManager";
import {
	filterItems,
	type ItemFilter,
	type SortState,
	sortItems,
} from "@/lib/itemQuery";
import type { Zoom } from "@/lib/timeline";

export const Route = createFileRoute("/roadmaps/$id")({
	ssr: false,
	component: RoadmapEditor,
});

const toolbarBtn =
	"rounded-md border border-neutral-200 px-2.5 py-2 text-sm hover:bg-neutral-100";

function RoadmapEditor() {
	const { id } = Route.useParams();
	const roadmapId = id as Id<"roadmaps">;
	const { isAuthenticated } = useConvexAuth();
	const bundle = useQuery(
		api.roadmaps.getBundle,
		isAuthenticated ? { roadmapId } : "skip",
	);
	const updateItem = useMutation(api.items.update);
	const createLane = useMutation(api.lanes.create);
	const createDependency = useMutation(api.dependencies.create);
	const removeDependency = useMutation(api.dependencies.remove);
	const [zoom, setZoom] = useState<Zoom | null>(null);
	const [view, setView] = useState<"timeline" | "table">("timeline");
	const [editing, setEditing] = useState<Id<"items"> | null>(null);
	const [newItem, setNewItem] = useState<null | {
		laneId?: Id<"lanes">;
		startMs?: number;
	}>(null);
	const [lanesOpen, setLanesOpen] = useState(false);
	const [fieldsOpen, setFieldsOpen] = useState(false);
	const [milestonesOpen, setMilestonesOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [ioOpen, setIoOpen] = useState(false);
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [aiOpen, setAiOpen] = useState(false);
	const [filter, setFilter] = useState<ItemFilter>({
		search: "",
		laneId: "all",
		fieldKey: null,
		optionId: "all",
	});
	const [sort, setSort] = useState<SortState>({ key: "startDate", dir: 1 });
	const [depError, setDepError] = useState<string | null>(null);

	if (bundle === undefined) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const activeZoom: Zoom = zoom ?? bundle.roadmap.defaultZoom;
	const editingItem = editing
		? (bundle.items.find((i) => i._id === editing) ?? null)
		: null;
	const panelOpen = editing !== null || newItem !== null;
	const visibleItems = sortItems(filterItems(bundle.items, filter), sort);
	const visibleBundle = { ...bundle, items: visibleItems };

	return (
		<AppShell>
			<div className="p-6">
				<header className="mb-4 space-y-3">
					<div>
						<p className="rm-label">Roadmap</p>
						<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="inline-flex overflow-hidden rounded-md border border-neutral-200">
							{(["timeline", "table"] as const).map((v) => (
								<button
									key={v}
									type="button"
									onClick={() => setView(v)}
									className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
										v === view
											? "bg-neutral-100 text-neutral-900"
											: "text-neutral-500"
									}`}
								>
									{v}
								</button>
							))}
						</div>
						{view === "timeline" ? (
							<ZoomSwitch value={activeZoom} onChange={setZoom} />
						) : null}
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setLanesOpen(true)}
						>
							Lanes
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setFieldsOpen(true)}
						>
							Fields
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setMilestonesOpen(true)}
						>
							Milestones
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setSettingsOpen(true)}
						>
							Settings
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setShareOpen(true)}
						>
							Share
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setIoOpen(true)}
						>
							Edit JSON data
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setVersionsOpen(true)}
						>
							Versions
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setAiOpen((v) => !v)}
							aria-label={aiOpen ? "Close AI assistant" : "Open AI assistant"}
						>
							<Sparkles size={16} />
						</button>
						<button
							type="button"
							onClick={() => setNewItem({})}
							className="rm-btn-primary"
						>
							New item
						</button>
					</div>
				</header>

				<div className="mb-3">
					<FilterBar
						lanes={bundle.lanes}
						fields={bundle.fields}
						filter={filter}
						onChange={setFilter}
					/>
				</div>

				{depError ? (
					<div className="mb-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
						<span>{depError}</span>
						<button
							type="button"
							onClick={() => setDepError(null)}
							className="ml-2 shrink-0 font-medium underline"
						>
							Dismiss
						</button>
					</div>
				) : null}

				{view === "timeline" ? (
					<TimelineView
						bundle={visibleBundle}
						zoom={activeZoom}
						onSelectItem={(itemId) => setEditing(itemId)}
						onItemDatesChange={(itemId, startDate, endDate, laneId) =>
							updateItem({ itemId, startDate, endDate, laneId })
						}
						onAddItem={(laneId, startMs) => setNewItem({ laneId, startMs })}
						onAddLane={(name) => createLane({ roadmapId, name })}
						onCreateDependency={(predecessorId, successorId) => {
							setDepError(null);
							createDependency({
								roadmapId,
								predecessorId,
								successorId,
							}).catch((e) =>
								setDepError(
									e instanceof Error ? e.message : "Could not add dependency",
								),
							);
						}}
						onRemoveDependency={(id) => {
							setDepError(null);
							removeDependency({ dependencyId: id }).catch((e) =>
								setDepError(
									e instanceof Error
										? e.message
										: "Could not remove dependency",
								),
							);
						}}
					/>
				) : (
					<ItemTable
						items={visibleItems}
						fields={bundle.fields}
						lanes={bundle.lanes}
						sort={sort}
						onSortChange={setSort}
						onSelect={(itemId) => setEditing(itemId)}
					/>
				)}
			</div>

			{panelOpen ? (
				<ItemEditorPanel
					roadmapId={roadmapId}
					item={editingItem}
					fields={bundle.fields}
					lanes={bundle.lanes}
					allItems={bundle.items}
					dependencies={bundle.dependencies}
					windowStart={bundle.roadmap.startDate}
					presetLaneId={newItem?.laneId}
					presetStartMs={newItem?.startMs}
					onClose={() => {
						setEditing(null);
						setNewItem(null);
					}}
				/>
			) : null}

			{aiOpen ? (
				<div className="fixed inset-y-0 right-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-neutral-200 bg-white shadow-xl">
					<ChatPanel docRef={{ kind: "roadmap", id: roadmapId }} />
				</div>
			) : null}

			<LaneManager
				roadmapId={roadmapId}
				lanes={bundle.lanes}
				open={lanesOpen}
				onOpenChange={setLanesOpen}
			/>
			<FieldManager
				roadmapId={roadmapId}
				fields={bundle.fields}
				open={fieldsOpen}
				onOpenChange={setFieldsOpen}
			/>
			<MilestoneManager
				roadmapId={roadmapId}
				milestones={bundle.milestones}
				open={milestonesOpen}
				onOpenChange={setMilestonesOpen}
			/>
			<RoadmapSettingsDialog
				roadmap={bundle.roadmap}
				fields={bundle.fields}
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
			/>
			<ShareDialog
				roadmap={bundle.roadmap}
				open={shareOpen}
				onOpenChange={setShareOpen}
			/>
			<ImportExportDialog
				bundle={bundle}
				open={ioOpen}
				onOpenChange={setIoOpen}
			/>
			<VersionManager
				roadmapId={roadmapId}
				open={versionsOpen}
				onOpenChange={setVersionsOpen}
			/>
		</AppShell>
	);
}

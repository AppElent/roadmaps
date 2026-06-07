import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FieldManager } from "@/components/fields/FieldManager";
import { LaneManager } from "@/components/lanes/LaneManager";
import { MilestoneManager } from "@/components/milestones/MilestoneManager";
import { ItemEditorPanel } from "@/components/panel/ItemEditorPanel";
import { RoadmapSettingsDialog } from "@/components/roadmaps/RoadmapSettingsDialog";
import { TimelineView } from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
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
	const bundle = useQuery(api.roadmaps.getBundle, { roadmapId });
	const updateItem = useMutation(api.items.update);
	const [zoom, setZoom] = useState<Zoom | null>(null);
	const [editing, setEditing] = useState<"new" | Id<"items"> | null>(null);
	const [lanesOpen, setLanesOpen] = useState(false);
	const [fieldsOpen, setFieldsOpen] = useState(false);
	const [milestonesOpen, setMilestonesOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);

	if (bundle === undefined) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const activeZoom: Zoom = zoom ?? bundle.roadmap.defaultZoom;
	const editingItem =
		editing && editing !== "new"
			? (bundle.items.find((i) => i._id === editing) ?? null)
			: null;

	return (
		<AppShell>
			<div className="p-6">
				<header className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<div>
						<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
							Roadmap
						</p>
						<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<ZoomSwitch value={activeZoom} onChange={setZoom} />
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
							onClick={() => setEditing("new")}
							className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
						>
							New item
						</button>
					</div>
				</header>
				<TimelineView
					bundle={bundle}
					zoom={activeZoom}
					onSelectItem={(itemId) => setEditing(itemId)}
					onItemDatesChange={(itemId, startDate, endDate) =>
						updateItem({ itemId, startDate, endDate })
					}
				/>
			</div>

			{editing !== null ? (
				<ItemEditorPanel
					roadmapId={roadmapId}
					item={editingItem}
					fields={bundle.fields}
					lanes={bundle.lanes}
					windowStart={bundle.roadmap.startDate}
					onClose={() => setEditing(null)}
				/>
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
		</AppShell>
	);
}

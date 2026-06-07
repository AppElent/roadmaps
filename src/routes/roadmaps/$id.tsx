import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ItemEditorPanel } from "@/components/panel/ItemEditorPanel";
import { TimelineView } from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
import type { Zoom } from "@/lib/timeline";

export const Route = createFileRoute("/roadmaps/$id")({
	ssr: false,
	component: RoadmapEditor,
});

function RoadmapEditor() {
	const { id } = Route.useParams();
	const roadmapId = id as Id<"roadmaps">;
	const bundle = useQuery(api.roadmaps.getBundle, { roadmapId });
	const [zoom, setZoom] = useState<Zoom | null>(null);
	const [editing, setEditing] = useState<"new" | Id<"items"> | null>(null);

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
				<header className="mb-4 flex items-center justify-between">
					<div>
						<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
							Roadmap
						</p>
						<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
					</div>
					<div className="flex items-center gap-2">
						<ZoomSwitch value={activeZoom} onChange={setZoom} />
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
		</AppShell>
	);
}

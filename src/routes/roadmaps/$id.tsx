import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TimelineView } from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
import type { Zoom } from "@/lib/timeline";

export const Route = createFileRoute("/roadmaps/$id")({
	ssr: false,
	component: RoadmapEditor,
});

function RoadmapEditor() {
	const { id } = Route.useParams();
	const bundle = useQuery(api.roadmaps.getBundle, {
		roadmapId: id as Id<"roadmaps">,
	});
	const [zoom, setZoom] = useState<Zoom | null>(null);

	if (bundle === undefined) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const activeZoom: Zoom = zoom ?? bundle.roadmap.defaultZoom;

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
					<ZoomSwitch value={activeZoom} onChange={setZoom} />
				</header>
				<TimelineView bundle={bundle} zoom={activeZoom} />
			</div>
		</AppShell>
	);
}

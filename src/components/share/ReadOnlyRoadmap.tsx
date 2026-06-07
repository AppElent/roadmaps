import { useState } from "react";
import { ItemTable } from "@/components/table/ItemTable";
import {
	type TimelineBundle,
	TimelineView,
} from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
import { type SortState, sortItems } from "@/lib/itemQuery";
import type { Zoom } from "@/lib/timeline";

export function ReadOnlyRoadmap({ bundle }: { bundle: TimelineBundle }) {
	const [zoom, setZoom] = useState<Zoom>(bundle.roadmap.defaultZoom);
	const [view, setView] = useState<"timeline" | "table">("timeline");
	const [sort, setSort] = useState<SortState>({ key: "startDate", dir: 1 });
	const sortedItems = sortItems(bundle.items, sort);

	return (
		<div className="mx-auto max-w-6xl p-6">
			<header className="mb-4 flex items-center justify-between">
				<div>
					<p className="rm-label">Shared roadmap (read-only)</p>
					<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
				</div>
				<div className="flex items-center gap-2">
					{view === "timeline" ? (
						<ZoomSwitch value={zoom} onChange={setZoom} />
					) : null}
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
				</div>
			</header>
			{view === "timeline" ? (
				<TimelineView bundle={bundle} zoom={zoom} />
			) : (
				<ItemTable
					items={sortedItems}
					fields={bundle.fields}
					lanes={bundle.lanes}
					sort={sort}
					onSortChange={setSort}
					onSelect={() => {}}
				/>
			)}
		</div>
	);
}

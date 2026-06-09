import type { Doc } from "@convex/_generated/dataModel";
import { useMemo, useRef } from "react";
import { barColor } from "@/lib/roadmapColors";
import {
	buildPeriods,
	type DragMode,
	dateToX,
	itemGeometry,
	laneAtY,
	laneLayout,
	packLanes,
	resolveDrag,
	type Zoom,
} from "@/lib/timeline";
import { LaneRow } from "./LaneRow";
import { MilestoneMarker } from "./MilestoneMarker";
import { TimeAxis } from "./TimeAxis";

export const COLUMN_WIDTH = 140;
export const LABEL_WIDTH = 170;
export const ROW_HEIGHT = 36;
export const ROW_GAP = 8;

export interface TimelineBundle {
	roadmap: Doc<"roadmaps">;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	items: Doc<"items">[];
	milestones: Doc<"milestones">[];
}

export function TimelineView({
	bundle,
	zoom,
	onSelectItem,
	onItemDatesChange,
}: {
	bundle: TimelineBundle;
	zoom: Zoom;
	onSelectItem?: (id: Doc<"items">["_id"]) => void;
	onItemDatesChange?: (
		itemId: Doc<"items">["_id"],
		startDate: number,
		endDate: number,
		laneId?: Doc<"lanes">["_id"],
	) => void;
}) {
	const { roadmap, fields, lanes, items, milestones } = bundle;
	const lanesRef = useRef<HTMLDivElement>(null);

	const periods = useMemo(
		() => buildPeriods(roadmap.startDate, roadmap.endDate, zoom),
		[roadmap.startDate, roadmap.endDate, zoom],
	);
	const axisWidth = periods.length * COLUMN_WIDTH;
	const windowStart = periods[0]?.start ?? roadmap.startDate;
	const windowEnd = periods[periods.length - 1]?.end ?? roadmap.endDate;

	const layout = useMemo(
		() => laneLayout(lanes, items, ROW_HEIGHT, ROW_GAP),
		[lanes, items],
	);
	const totalHeight = layout.at(-1)?.bottom ?? 0;

	const handleItemDrag = onItemDatesChange
		? (item: Doc<"items">, mode: DragMode, deltaX: number, clientY: number) => {
				const next = resolveDrag(
					mode,
					item,
					deltaX,
					windowStart,
					windowEnd,
					axisWidth,
					zoom,
				);
				let laneId: Doc<"lanes">["_id"] | undefined;
				if (mode === "move" && lanesRef.current) {
					const top = lanesRef.current.getBoundingClientRect().top;
					const target = laneAtY(layout, clientY - top);
					if (target && target !== item.laneId) {
						laneId = target as Doc<"lanes">["_id"];
					}
				}
				onItemDatesChange(item._id, next.startDate, next.endDate, laneId);
			}
		: undefined;

	return (
		<div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
			<div style={{ width: LABEL_WIDTH + axisWidth }}>
				<TimeAxis
					periods={periods}
					columnWidth={COLUMN_WIDTH}
					labelWidth={LABEL_WIDTH}
				/>
				<div className="relative" ref={lanesRef}>
					{lanes.map((lane) => {
						const laneItems = items.filter((i) => i.laneId === lane._id);
						const rows = packLanes(laneItems);
						const geometries = laneItems.map((it) =>
							itemGeometry(it, windowStart, windowEnd, axisWidth),
						);
						const colors = laneItems.map((it) =>
							barColor(it, fields, roadmap.colorByFieldKey),
						);
						return (
							<LaneRow
								key={lane._id}
								lane={lane}
								items={laneItems}
								rows={rows}
								geometries={geometries}
								colors={colors}
								rowHeight={ROW_HEIGHT}
								rowGap={ROW_GAP}
								labelWidth={LABEL_WIDTH}
								axisWidth={axisWidth}
								unitWidth={COLUMN_WIDTH}
								onSelect={onSelectItem}
								onItemDrag={handleItemDrag}
							/>
						);
					})}
					<div
						className="pointer-events-none absolute top-0"
						style={{ left: LABEL_WIDTH, width: axisWidth, height: totalHeight }}
					>
						{milestones.map((m) => (
							<MilestoneMarker
								key={m._id}
								milestone={m}
								x={dateToX(m.date, windowStart, windowEnd, axisWidth)}
								height={totalHeight}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

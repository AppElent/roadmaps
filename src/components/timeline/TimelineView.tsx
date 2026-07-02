import type { Doc } from "@convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ItemRect } from "@/lib/dependencies";
import { barColor } from "@/lib/roadmapColors";
import {
	buildPeriods,
	columnWidth,
	type DragMode,
	dateToX,
	fitColumnWidth,
	itemGeometry,
	laneAtY,
	laneLayout,
	packLanes,
	resolveDrag,
	xToDate,
	type Zoom,
} from "@/lib/timeline";
import { AddLaneRow } from "./AddLaneRow";
import { DependencyLayer } from "./DependencyLayer";
import { LaneRow } from "./LaneRow";
import { MilestoneMarker } from "./MilestoneMarker";
import { TimeAxis } from "./TimeAxis";

export const LABEL_WIDTH = 170;
export const ROW_HEIGHT = 36;
export const ROW_GAP = 8;

export interface TimelineBundle {
	roadmap: Doc<"roadmaps">;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	items: Doc<"items">[];
	milestones: Doc<"milestones">[];
	dependencies: Doc<"dependencies">[];
}

export function TimelineView({
	bundle,
	zoom,
	onSelectItem,
	onItemDatesChange,
	onAddItem,
	onAddLane,
	onRemoveDependency,
	onCreateDependency,
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
	onAddItem?: (laneId: Doc<"lanes">["_id"], startMs?: number) => void;
	onAddLane?: (name: string) => void;
	onRemoveDependency?: (id: Doc<"dependencies">["_id"]) => void;
	onCreateDependency?: (
		predecessorId: Doc<"items">["_id"],
		successorId: Doc<"items">["_id"],
	) => void;
}) {
	const { roadmap, fields, lanes, items, milestones, dependencies } = bundle;
	const scrollRef = useRef<HTMLDivElement>(null);
	const lanesRef = useRef<HTMLDivElement>(null);
	const [guideX, setGuideX] = useState<number | null>(null);
	const [containerWidth, setContainerWidth] = useState(0);

	const periods = useMemo(
		() => buildPeriods(roadmap.startDate, roadmap.endDate, zoom),
		[roadmap.startDate, roadmap.endDate, zoom],
	);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			setContainerWidth(entries[0].contentRect.width);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Stretch columns to fill the container at low column counts; fall back to
	// the per-zoom base width (which scrolls) at high counts. The -2 buffer keeps
	// subpixel rounding from triggering a stray horizontal scrollbar.
	const colW = fitColumnWidth(
		columnWidth(zoom),
		periods.length,
		containerWidth - LABEL_WIDTH - 2,
	);
	const axisWidth = periods.length * colW;
	const windowStart = periods[0]?.start ?? roadmap.startDate;
	const windowEnd = periods[periods.length - 1]?.end ?? roadmap.endDate;
	const colorMode = roadmap.barColorMode ?? "left";

	const layout = useMemo(
		() => laneLayout(lanes, items, ROW_HEIGHT, ROW_GAP),
		[lanes, items],
	);
	const totalHeight = layout.at(-1)?.bottom ?? 0;

	const itemRects = useMemo(() => {
		const map = new Map<string, ItemRect>();
		for (const lane of lanes) {
			const laneItems = items.filter((i) => i.laneId === lane._id);
			const rows = packLanes(laneItems);
			const bound = layout.find((b) => b.laneId === lane._id);
			laneItems.forEach((it, i) => {
				const g = itemGeometry(it, windowStart, windowEnd, axisWidth);
				map.set(it._id, {
					left: g.left,
					width: g.width,
					top: (bound?.top ?? 0) + rows[i] * (ROW_HEIGHT + ROW_GAP) + ROW_GAP,
					height: ROW_HEIGHT,
				});
			});
		}
		return map;
	}, [lanes, items, layout, windowStart, windowEnd, axisWidth]);

	const itemAtClient = (clientX: number, clientY: number) => {
		const el = lanesRef.current;
		if (!el) return null;
		const box = el.getBoundingClientRect();
		const x = clientX - box.left - LABEL_WIDTH;
		const y = clientY - box.top;
		for (const [id, r] of itemRects) {
			if (
				x >= r.left &&
				x <= r.left + r.width &&
				y >= r.top &&
				y <= r.top + r.height
			) {
				return id;
			}
		}
		return null;
	};

	const handleItemLinkCommit = onCreateDependency
		? (item: Doc<"items">, clientX: number, clientY: number) => {
				const targetId = itemAtClient(clientX, clientY);
				if (targetId && targetId !== item._id) {
					onCreateDependency(item._id, targetId as Doc<"items">["_id"]);
				}
			}
		: undefined;

	const editable = Boolean(onItemDatesChange);

	const previewGeometryFor = editable
		? (item: Doc<"items">, mode: DragMode, deltaX: number) => {
				const next = resolveDrag(
					mode,
					item,
					deltaX,
					windowStart,
					windowEnd,
					axisWidth,
					zoom,
				);
				return itemGeometry(next, windowStart, windowEnd, axisWidth);
			}
		: undefined;

	const handleItemDragMove = editable
		? (item: Doc<"items">, mode: DragMode, deltaX: number) => {
				const next = resolveDrag(
					mode,
					item,
					deltaX,
					windowStart,
					windowEnd,
					axisWidth,
					zoom,
				);
				const edge = mode === "resize-end" ? next.endDate : next.startDate;
				const x = dateToX(edge, windowStart, windowEnd, axisWidth);
				setGuideX(Math.max(0, Math.min(axisWidth, x)));
			}
		: undefined;

	const handleItemDrag = onItemDatesChange
		? (item: Doc<"items">, mode: DragMode, deltaX: number, clientY: number) => {
				setGuideX(null);
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
		<div
			ref={scrollRef}
			className="overflow-auto rounded-lg border border-neutral-200 bg-white"
		>
			<div style={{ width: LABEL_WIDTH + axisWidth }}>
				<TimeAxis
					periods={periods}
					columnWidth={colW}
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
								colorMode={colorMode}
								rowHeight={ROW_HEIGHT}
								rowGap={ROW_GAP}
								labelWidth={LABEL_WIDTH}
								axisWidth={axisWidth}
								unitWidth={colW}
								onSelect={onSelectItem}
								onItemDrag={handleItemDrag}
								onItemDragMove={handleItemDragMove}
								onItemDragEnd={editable ? () => setGuideX(null) : undefined}
								previewGeometryFor={previewGeometryFor}
								onAddItem={
									onAddItem ? (laneId) => onAddItem(laneId) : undefined
								}
								onAddItemAt={
									onAddItem
										? (laneId, localX) =>
												onAddItem(
													laneId,
													xToDate(localX, windowStart, windowEnd, axisWidth),
												)
										: undefined
								}
								onItemLinkCommit={handleItemLinkCommit}
							/>
						);
					})}
					{onAddLane ? (
						<AddLaneRow labelWidth={LABEL_WIDTH} onAdd={onAddLane} />
					) : null}
					<div
						className="pointer-events-none absolute top-0"
						style={{ left: LABEL_WIDTH, width: axisWidth, height: totalHeight }}
					>
						<DependencyLayer
							deps={dependencies}
							rects={itemRects}
							width={axisWidth}
							height={totalHeight}
							onRemove={
								editable && onRemoveDependency
									? (id) => onRemoveDependency(id as Doc<"dependencies">["_id"])
									: undefined
							}
						/>
						{guideX !== null ? (
							<div
								className="absolute top-0 w-px bg-blue-500"
								style={{ left: guideX, height: totalHeight }}
							/>
						) : null}
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

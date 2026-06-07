import type { Doc } from "@convex/_generated/dataModel";

export function MilestoneMarker({
	milestone,
	x,
	height,
}: {
	milestone: Doc<"milestones">;
	x: number;
	height: number;
}) {
	return (
		<div
			style={{ left: x, height }}
			className="pointer-events-none absolute top-0 z-20 w-px bg-neutral-400"
			title={milestone.name}
		>
			<span
				style={{ backgroundColor: milestone.color ?? "#404040" }}
				className="absolute -left-1 -top-0.5 size-2 rounded-full"
			/>
		</div>
	);
}

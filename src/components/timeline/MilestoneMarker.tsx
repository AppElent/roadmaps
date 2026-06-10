import type { Doc } from "@convex/_generated/dataModel";
import { Popover } from "radix-ui";
import { useState } from "react";
import { msToDateInput } from "@/lib/fields";

export function MilestoneMarker({
	milestone,
	x,
	height,
}: {
	milestone: Doc<"milestones">;
	x: number;
	height: number;
}) {
	const [hovered, setHovered] = useState(false);
	const [pinned, setPinned] = useState(false);
	const color = milestone.color ?? "#404040";

	return (
		<div
			style={{ left: x, height }}
			className="pointer-events-none absolute top-0 z-20"
		>
			<div
				style={{ backgroundColor: color, height }}
				className="absolute top-0 w-px"
			/>
			<Popover.Root
				open={hovered || pinned}
				onOpenChange={(o) => {
					if (!o) {
						setPinned(false);
						setHovered(false);
					}
				}}
			>
				<Popover.Trigger asChild>
					<button
						type="button"
						aria-label={milestone.name}
						onPointerEnter={() => setHovered(true)}
						onPointerLeave={() => setHovered(false)}
						onClick={() => setPinned((p) => !p)}
						style={{ backgroundColor: color }}
						className="pointer-events-auto absolute -left-1 -top-0.5 size-2 rounded-full"
					/>
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content
						sideOffset={6}
						className="z-50 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-md"
					>
						<p className="font-medium">{milestone.name}</p>
						<p className="font-mono text-[11px] text-neutral-500">
							{msToDateInput(milestone.date)}
						</p>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		</div>
	);
}

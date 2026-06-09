import type { Doc } from "@convex/_generated/dataModel";
import { useRef, useState } from "react";
import type { DragMode } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export function ItemBar({
	item,
	left,
	width,
	top,
	color,
	unitWidth,
	onSelect,
	onDragCommit,
}: {
	item: Doc<"items">;
	left: number;
	width: number;
	top: number;
	color: string;
	unitWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
	onDragCommit?: (mode: DragMode, deltaX: number, clientY: number) => void;
}) {
	const [offset, setOffset] = useState<{ dx: number; dw: number; dy: number }>({
		dx: 0,
		dw: 0,
		dy: 0,
	});
	const [dragging, setDragging] = useState(false);
	const drag = useRef<{
		mode: DragMode;
		startX: number;
		startY: number;
	} | null>(null);
	const editable = Boolean(onDragCommit);

	function begin(mode: DragMode, e: React.PointerEvent) {
		if (!editable) return;
		e.preventDefault();
		e.stopPropagation();
		(e.target as Element).setPointerCapture(e.pointerId);
		drag.current = { mode, startX: e.clientX, startY: e.clientY };
		setDragging(true);
	}

	function move(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		const dy = e.clientY - drag.current.startY;
		if (drag.current.mode === "move") setOffset({ dx, dw: 0, dy });
		else if (drag.current.mode === "resize-end")
			setOffset({ dx: 0, dw: dx, dy: 0 });
		else setOffset({ dx, dw: -dx, dy: 0 });
	}

	function end(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		const dy = e.clientY - drag.current.startY;
		const mode = drag.current.mode;
		drag.current = null;
		setDragging(false);
		setOffset({ dx: 0, dw: 0, dy: 0 });
		if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
			onSelect?.(item._id);
			return;
		}
		onDragCommit?.(mode, dx, e.clientY);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: a <button> can't legally contain the nested interactive resize handles; using role="button" with keyboard handlers instead
		<div
			role="button"
			tabIndex={0}
			onPointerDown={(e) => begin("move", e)}
			onPointerMove={move}
			onPointerUp={end}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect?.(item._id);
				if (e.key === "ArrowRight")
					onDragCommit?.("move", unitWidth, Number.NaN);
				if (e.key === "ArrowLeft")
					onDragCommit?.("move", -unitWidth, Number.NaN);
			}}
			style={{
				left: left + offset.dx,
				width: Math.max(8, width + offset.dw),
				top: top + offset.dy,
				borderLeftColor: color,
			}}
			className={cn(
				"group absolute flex h-9 cursor-grab items-center overflow-hidden rounded-md border border-l-4 border-neutral-200 bg-white px-2 text-left text-xs shadow-sm hover:border-neutral-400 active:cursor-grabbing",
				dragging && "z-20 shadow-md",
			)}
		>
			{editable ? (
				<span
					onPointerDown={(e) => begin("resize-start", e)}
					className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
				/>
			) : null}
			<span className="block truncate font-medium">{item.title}</span>
			{editable ? (
				<span
					onPointerDown={(e) => begin("resize-end", e)}
					className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
				/>
			) : null}
		</div>
	);
}

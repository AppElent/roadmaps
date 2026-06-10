import type { Doc } from "@convex/_generated/dataModel";
import { useRef, useState } from "react";
import { readableTextOn } from "@/lib/roadmapColors";
import type { DragMode } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export function ItemBar({
	item,
	left,
	width,
	top,
	color,
	colorMode,
	unitWidth,
	onSelect,
	onDragCommit,
	onDragMove,
	previewGeometry,
}: {
	item: Doc<"items">;
	left: number;
	width: number;
	top: number;
	color: string;
	colorMode: "left" | "fill";
	unitWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
	onDragCommit?: (mode: DragMode, deltaX: number, clientY: number) => void;
	onDragMove?: (mode: DragMode, deltaX: number) => void;
	previewGeometry?: (
		mode: DragMode,
		deltaX: number,
	) => { left: number; width: number };
}) {
	const [preview, setPreview] = useState<{
		left: number;
		width: number;
	} | null>(null);
	const [dy, setDy] = useState(0);
	const [dragging, setDragging] = useState(false);
	const drag = useRef<{
		mode: DragMode;
		startX: number;
		startY: number;
	} | null>(null);
	const editable = Boolean(onDragCommit);
	const fill = colorMode === "fill";

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
		const mode = drag.current.mode;
		setDy(mode === "move" ? e.clientY - drag.current.startY : 0);
		if (previewGeometry) setPreview(previewGeometry(mode, dx));
		onDragMove?.(mode, dx);
	}

	function end(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		const dyy = e.clientY - drag.current.startY;
		const mode = drag.current.mode;
		drag.current = null;
		setDragging(false);
		setPreview(null);
		setDy(0);
		if (Math.abs(dx) < 3 && Math.abs(dyy) < 3) {
			onSelect?.(item._id);
			return;
		}
		onDragCommit?.(mode, dx, e.clientY);
	}

	const renderLeft = preview ? preview.left : left;
	const renderWidth = Math.max(8, preview ? preview.width : width);

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
				left: renderLeft,
				width: renderWidth,
				top: top + dy,
				...(fill
					? {
							backgroundColor: color,
							color: readableTextOn(color),
							borderColor: color,
						}
					: { borderLeftColor: color }),
			}}
			className={cn(
				"group absolute flex h-9 items-center overflow-hidden rounded-md border px-2 text-left text-xs shadow-sm",
				fill ? "border" : "border-l-4 border-neutral-200 bg-white",
				editable
					? "cursor-grab hover:border-neutral-400 active:cursor-grabbing"
					: "cursor-default",
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

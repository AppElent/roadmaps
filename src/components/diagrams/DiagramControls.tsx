import { Maximize, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { type RefObject, useState } from "react";
import { useControls, useTransformEffect } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";

const ctrlBtn =
	"grid h-7 w-7 place-items-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100";

/**
 * Zoom/pan toolbar overlay. Must be rendered inside a TransformWrapper so the
 * useControls / useTransformEffect hooks resolve. Fit-to-view scales the
 * referenced content node to fill the viewport.
 */
export function DiagramControls({
	contentRef,
}: {
	contentRef: RefObject<HTMLDivElement | null>;
}) {
	const { zoomIn, zoomOut, resetTransform, zoomToElement } = useControls();
	const [scale, setScale] = useState(1);

	useTransformEffect(({ state }) => {
		setScale(state.scale);
	});

	const fit = () => {
		if (contentRef.current) {
			zoomToElement(contentRef.current, undefined, 200, "easeOut");
		}
	};

	return (
		<div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/90 p-1 shadow-sm backdrop-blur">
			<button
				type="button"
				className={cn(ctrlBtn)}
				onClick={() => zoomOut()}
				aria-label="Zoom out"
			>
				<ZoomOut size={15} />
			</button>
			<span className="w-12 text-center text-xs tabular-nums text-neutral-500">
				{Math.round(scale * 100)}%
			</span>
			<button
				type="button"
				className={cn(ctrlBtn)}
				onClick={() => zoomIn()}
				aria-label="Zoom in"
			>
				<ZoomIn size={15} />
			</button>
			<button
				type="button"
				className={cn(ctrlBtn)}
				onClick={fit}
				aria-label="Fit to view"
			>
				<Maximize size={15} />
			</button>
			<button
				type="button"
				className={cn(ctrlBtn)}
				onClick={() => resetTransform(200, "easeOut")}
				aria-label="Reset zoom"
			>
				<RotateCcw size={15} />
			</button>
		</div>
	);
}

import { useEffect, useRef } from "react";
import {
	type ReactZoomPanPinchRef,
	TransformComponent,
	TransformWrapper,
} from "react-zoom-pan-pinch";
import { useDiagramRender } from "@/hooks/useDiagramRender";
import type { DiagramType } from "@/lib/diagramEngines";
import { DiagramControls } from "./DiagramControls";

export function DiagramPreview({
	type,
	source,
}: {
	type: DiagramType;
	source: string;
}) {
	const { svg, imgUrl, error, rendering } = useDiagramRender(type, source);
	const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const fittedRef = useRef(false);
	const hasContent = Boolean(svg || imgUrl);

	// Auto-fit the diagram to the viewport once, when content first appears.
	// Subsequent re-renders (e.g. while editing) keep the user's zoom/pan.
	useEffect(() => {
		if (!hasContent) {
			fittedRef.current = false;
			return;
		}
		if (fittedRef.current) return;
		const raf = requestAnimationFrame(() => {
			if (contentRef.current && transformRef.current) {
				transformRef.current.zoomToElement(contentRef.current, undefined, 0);
				fittedRef.current = true;
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [hasContent]);

	return (
		<div className="relative h-full overflow-hidden">
			{error ? (
				<div className="absolute inset-x-2 top-2 z-20 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{error}
				</div>
			) : null}
			{rendering ? (
				<span className="absolute bottom-2 left-2 z-20 text-[11px] text-neutral-400">
					Rendering…
				</span>
			) : null}
			{hasContent ? (
				<TransformWrapper
					ref={transformRef}
					minScale={0.1}
					maxScale={8}
					initialScale={1}
					centerOnInit
					wheel={{ step: 0.005 }}
					limitToBounds={false}
				>
					<DiagramControls contentRef={contentRef} />
					<TransformComponent
						wrapperStyle={{ width: "100%", height: "100%" }}
						contentStyle={{
							width: "100%",
							height: "100%",
							display: "grid",
							placeItems: "center",
							padding: "1rem",
						}}
					>
						<div ref={contentRef}>
							{svg ? (
								// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is generated locally with securityLevel "strict"
								<div dangerouslySetInnerHTML={{ __html: svg }} />
							) : (
								<img src={imgUrl ?? ""} alt="Diagram preview" />
							)}
						</div>
					</TransformComponent>
				</TransformWrapper>
			) : (
				<div className="grid min-h-full place-items-center p-4">
					<p className="text-sm text-neutral-400">
						Start typing to render the diagram.
					</p>
				</div>
			)}
		</div>
	);
}

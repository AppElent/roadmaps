import { useDiagramRender } from "@/hooks/useDiagramRender";
import type { DiagramType } from "@/lib/diagramEngines";

export function DiagramPreview({
	type,
	source,
}: {
	type: DiagramType;
	source: string;
}) {
	const { svg, imgUrl, error, rendering } = useDiagramRender(type, source);
	return (
		<div className="relative h-full overflow-auto">
			{error ? (
				<div className="absolute inset-x-2 top-2 z-10 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{error}
				</div>
			) : null}
			{rendering ? (
				<span className="absolute bottom-2 right-2 z-10 text-[11px] text-neutral-400">
					Rendering…
				</span>
			) : null}
			<div className="grid min-h-full place-items-center p-4">
				{svg ? (
					// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is generated locally with securityLevel "strict"
					<div dangerouslySetInnerHTML={{ __html: svg }} />
				) : imgUrl ? (
					<img src={imgUrl} alt="Diagram preview" className="max-w-full" />
				) : (
					<p className="text-sm text-neutral-400">
						Start typing to render the diagram.
					</p>
				)}
			</div>
		</div>
	);
}

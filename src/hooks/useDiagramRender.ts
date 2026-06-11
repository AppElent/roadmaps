import { useEffect, useRef, useState } from "react";
import { DIAGRAM_ENGINES, type DiagramType } from "@/lib/diagramEngines";
import { renderKroki } from "@/lib/kroki";

let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
	if (!mermaidLoader) {
		mermaidLoader = import("mermaid").then((mod) => {
			mod.default.initialize({
				startOnLoad: false,
				securityLevel: "strict",
				theme: "neutral",
			});
			return mod.default;
		});
	}
	return mermaidLoader;
}

/**
 * Debounced diagram rendering with last-good-render retention: on a
 * parse/render error the previous svg/imgUrl is kept and `error` is set.
 * Exactly one of svg (mermaid) and imgUrl (kroki object URL) is non-null
 * after a successful render.
 */
export function useDiagramRender(type: DiagramType, source: string) {
	const engine = DIAGRAM_ENGINES[type];
	const [svg, setSvg] = useState<string | null>(null);
	const [imgUrl, setImgUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [rendering, setRendering] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const seqRef = useRef(0);

	useEffect(() => {
		const seq = ++seqRef.current;
		const replaceImgUrl = (next: string | null) => {
			setImgUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return next;
			});
		};
		if (!source.trim()) {
			setSvg(null);
			replaceImgUrl(null);
			setError(null);
			return;
		}
		const timer = setTimeout(async () => {
			setRendering(true);
			try {
				if (engine.strategy === "client-mermaid") {
					const mermaid = await loadMermaid();
					await mermaid.parse(source);
					const { svg: out } = await mermaid.render(`diagram-${seq}`, source);
					if (seq !== seqRef.current) return;
					setSvg(out);
					replaceImgUrl(null);
					setError(null);
				} else {
					abortRef.current?.abort();
					const controller = new AbortController();
					abortRef.current = controller;
					const url = await renderKroki(
						engine.krokiType ?? type,
						source,
						controller.signal,
					);
					if (seq !== seqRef.current) {
						URL.revokeObjectURL(url);
						return;
					}
					replaceImgUrl(url);
					setSvg(null);
					setError(null);
				}
			} catch (e) {
				if (e instanceof DOMException && e.name === "AbortError") return;
				if (seq !== seqRef.current) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (seq === seqRef.current) setRendering(false);
			}
		}, engine.debounceMs);
		return () => clearTimeout(timer);
	}, [engine, type, source]);

	return { svg, imgUrl, error, rendering };
}

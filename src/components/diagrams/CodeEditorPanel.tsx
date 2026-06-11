import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { mermaid as mermaidLang } from "codemirror-lang-mermaid";
import { useEffect, useRef } from "react";
import type { DiagramType } from "@/lib/diagramEngines";

export function CodeEditorPanel({
	value,
	language,
	onChange,
}: {
	value: string;
	language: DiagramType;
	onChange: (next: string) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	// biome-ignore lint/correctness/useExhaustiveDependencies: the editor is created once per language; value sync is handled by the effect below
	useEffect(() => {
		if (!containerRef.current) return;
		const extensions = [
			basicSetup,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onChangeRef.current(update.state.doc.toString());
				}
			}),
			EditorView.theme({
				"&": { height: "100%", fontSize: "13px" },
				".cm-scroller": { fontFamily: "ui-monospace, monospace" },
			}),
		];
		if (language === "mermaid") {
			extensions.push(mermaidLang());
		}
		const view = new EditorView({
			state: EditorState.create({ doc: value, extensions }),
			parent: containerRef.current,
		});
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [language]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		const current = view.state.doc.toString();
		if (value !== current) {
			view.dispatch({
				changes: { from: 0, to: current.length, insert: value },
			});
		}
	}, [value]);

	return <div ref={containerRef} className="h-full overflow-hidden" />;
}

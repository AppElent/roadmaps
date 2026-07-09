import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
	ArrowLeft,
	PanelLeftClose,
	PanelLeftOpen,
	Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { CodeEditorPanel } from "@/components/diagrams/CodeEditorPanel";
import { DiagramPreview } from "@/components/diagrams/DiagramPreview";
import { DiagramShareDialog } from "@/components/diagrams/DiagramShareDialog";
import { DiagramVersionManager } from "@/components/diagrams/DiagramVersionManager";

export const Route = createFileRoute("/diagrams/$id")({
	ssr: false,
	component: DiagramEditor,
});

const toolbarBtn =
	"rounded-md border border-neutral-200 px-2.5 py-2 text-sm hover:bg-neutral-100";

const SAVE_DEBOUNCE_MS = 1000;

function DiagramEditor() {
	const { id } = Route.useParams();
	const diagramId = id as Id<"diagrams">;
	const { isAuthenticated } = useConvexAuth();
	const diagram = useQuery(
		api.diagrams.get,
		isAuthenticated ? { diagramId } : "skip",
	);
	const update = useMutation(api.diagrams.update);

	const [source, setSource] = useState<string | null>(null);
	const sourceRef = useRef<string | null>(null);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [codeOpen, setCodeOpen] = useState(() =>
		typeof window === "undefined" ? true : window.innerWidth >= 768,
	);
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [aiOpen, setAiOpen] = useState(false);

	// Adopt remote source when there are no unsaved local edits (covers the
	// initial load, restores, and edits arriving from another tab).
	useEffect(() => {
		if (diagram && !dirty) {
			setSource(diagram.source);
			sourceRef.current = diagram.source;
		}
	}, [diagram, dirty]);

	// Debounced save; only clears the dirty flag if nothing was typed while
	// the save was in flight.
	useEffect(() => {
		if (!dirty || source === null) return;
		const timer = setTimeout(async () => {
			const snapshot = source;
			setSaving(true);
			try {
				await update({ diagramId, source: snapshot });
			} finally {
				setSaving(false);
				if (sourceRef.current === snapshot) {
					setDirty(false);
				}
			}
		}, SAVE_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [dirty, source, diagramId, update]);

	if (diagram === undefined || source === null) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const handleSourceChange = (next: string) => {
		sourceRef.current = next;
		setSource(next);
		setDirty(true);
	};

	return (
		<AppShell>
			<div className="flex h-full flex-col p-4">
				<header className="mb-3 flex flex-wrap items-center gap-2">
					<Link
						to="/diagrams"
						className={toolbarBtn}
						aria-label="Back to diagrams"
					>
						<ArrowLeft size={16} />
					</Link>
					<input
						key={diagram.title}
						defaultValue={diagram.title}
						onBlur={(e) => {
							const title = e.target.value.trim();
							if (title && title !== diagram.title) {
								update({ diagramId, title });
							}
						}}
						className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1.5 text-lg font-semibold hover:border-neutral-200 focus:border-neutral-200 focus:outline-none"
					/>
					<span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
						{diagram.type}
					</span>
					<span className="w-16 text-right text-xs text-neutral-400">
						{saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
					</span>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setVersionsOpen(true)}
					>
						Versions
					</button>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setShareOpen(true)}
					>
						Share
					</button>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setAiOpen((v) => !v)}
						aria-label={aiOpen ? "Close AI assistant" : "Open AI assistant"}
					>
						<Sparkles size={16} />
					</button>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setCodeOpen((v) => !v)}
						aria-label={codeOpen ? "Collapse code panel" : "Expand code panel"}
					>
						{codeOpen ? (
							<PanelLeftClose size={16} />
						) : (
							<PanelLeftOpen size={16} />
						)}
					</button>
				</header>

				<div className="flex h-[calc(100dvh-180px)] min-h-[320px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white md:flex-row">
					{codeOpen ? (
						<div className="h-[45%] border-b border-neutral-200 md:h-auto md:w-[38%] md:min-w-[260px] md:border-b-0 md:border-r">
							<CodeEditorPanel
								value={source}
								language={diagram.type}
								onChange={handleSourceChange}
							/>
						</div>
					) : null}
					<div className="min-h-0 min-w-0 flex-1">
						<DiagramPreview type={diagram.type} source={source} />
					</div>
					{aiOpen ? (
						<div className="h-[45%] border-t border-neutral-200 md:h-auto md:w-[320px] md:shrink-0 md:border-t-0 md:border-l">
							<ChatPanel
								docRef={{ kind: "diagram", id: diagramId }}
								onClose={() => setAiOpen(false)}
							/>
						</div>
					) : null}
				</div>
			</div>

			<DiagramVersionManager
				diagramId={diagramId}
				open={versionsOpen}
				onOpenChange={setVersionsOpen}
			/>
			<DiagramShareDialog
				diagram={diagram}
				open={shareOpen}
				onOpenChange={setShareOpen}
			/>
		</AppShell>
	);
}

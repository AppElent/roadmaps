import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
	const [codeOpen, setCodeOpen] = useState(true);
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);

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

				<div className="flex h-[calc(100dvh-180px)] min-h-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
					{codeOpen ? (
						<div className="w-[38%] min-w-[260px] border-r border-neutral-200">
							<CodeEditorPanel
								value={source}
								language={diagram.type}
								onChange={handleSourceChange}
							/>
						</div>
					) : null}
					<div className="min-w-0 flex-1">
						<DiagramPreview type={diagram.type} source={source} />
					</div>
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

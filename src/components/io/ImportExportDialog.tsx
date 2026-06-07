import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type { TimelineBundle } from "@/components/timeline/TimelineView";
import { parseImport, serializeRoadmap } from "@/lib/roadmapIO";

export function ImportExportDialog({
	bundle,
	open,
	onOpenChange,
}: {
	bundle: TimelineBundle;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const navigate = useNavigate();
	const importRoadmap = useMutation(api.io.importRoadmap);
	const [tab, setTab] = useState<"export" | "import">("export");
	const [importText, setImportText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const exportText = JSON.stringify(serializeRoadmap(bundle), null, 2);

	async function runImport() {
		setError(null);
		try {
			const parsed = parseImport(importText);
			const { version: _v, ...payload } = parsed;
			const id = await importRoadmap({ payload });
			onOpenChange(false);
			await navigate({ to: "/roadmaps/$id", params: { id } });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Import failed");
		}
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Import / Export
					</Dialog.Title>
					<div className="mt-3 inline-flex overflow-hidden rounded-md border border-neutral-200">
						{(["export", "import"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTab(t)}
								className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
									t === tab ? "bg-neutral-100" : "text-neutral-500"
								}`}
							>
								{t}
							</button>
						))}
					</div>

					{tab === "export" ? (
						<div className="mt-3 space-y-2">
							<textarea
								readOnly
								value={exportText}
								className="h-64 w-full rounded-md border border-neutral-200 p-2 font-mono text-xs"
							/>
							<button
								type="button"
								onClick={() => navigator.clipboard.writeText(exportText)}
								className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm"
							>
								Copy JSON
							</button>
						</div>
					) : (
						<div className="mt-3 space-y-2">
							<textarea
								value={importText}
								onChange={(e) => setImportText(e.target.value)}
								placeholder="Paste exported roadmap JSON"
								className="h-64 w-full rounded-md border border-neutral-200 p-2 font-mono text-xs"
							/>
							{error ? <p className="text-xs text-red-600">{error}</p> : null}
							<button
								type="button"
								onClick={runImport}
								className="rm-btn-primary"
							>
								Import as new roadmap
							</button>
						</div>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

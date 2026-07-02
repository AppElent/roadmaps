import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type { TimelineBundle } from "@/components/timeline/TimelineView";
import { DialogCloseButton } from "@/components/ui/dialog-close";
import {
	parseImport,
	type RoadmapExport,
	serializeRoadmap,
} from "@/lib/roadmapIO";

type ImportPayload = Omit<RoadmapExport, "version">;

export function ImportExportDialog({
	bundle,
	open,
	onOpenChange,
}: {
	bundle: TimelineBundle;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<DialogCloseButton />
					<Dialog.Title className="text-base font-semibold">
						Edit JSON data
					</Dialog.Title>
					<JsonEditor bundle={bundle} onOpenChange={onOpenChange} />
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

function JsonEditor({
	bundle,
	onOpenChange,
}: {
	bundle: TimelineBundle;
	onOpenChange: (v: boolean) => void;
}) {
	const replaceRoadmap = useMutation(api.io.replaceRoadmap);
	const [text, setText] = useState(() =>
		JSON.stringify(serializeRoadmap(bundle), null, 2),
	);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<ImportPayload | null>(null);

	function validate() {
		setError(null);
		try {
			const { version: _v, ...payload } = parseImport(text);
			setPending(payload);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read JSON");
		}
	}

	async function confirmOverwrite() {
		if (!pending) return;
		setError(null);
		try {
			await replaceRoadmap({
				roadmapId: bundle.roadmap._id,
				payload: pending,
			});
			onOpenChange(false);
		} catch (e) {
			setPending(null);
			setError(e instanceof Error ? e.message : "Save failed");
		}
	}

	return (
		<div className="mt-3 space-y-3">
			<textarea
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					setPending(null);
					setError(null);
				}}
				placeholder="Roadmap JSON"
				className="h-64 w-full rounded-md border border-neutral-200 p-2 font-mono text-xs"
			/>
			{error ? (
				<p className="whitespace-pre-line text-xs text-red-600">{error}</p>
			) : null}

			{pending ? (
				<div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
					<div className="flex-1 space-y-2">
						<p className="text-sm text-amber-900">
							Overwrite this roadmap with the edited JSON? This replaces all
							lanes, items, fields and milestones.
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setPending(null)}
								className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={confirmOverwrite}
								className="rm-btn-primary"
							>
								Overwrite roadmap
							</button>
						</div>
					</div>
				</div>
			) : (
				<div className="flex justify-between">
					<button
						type="button"
						onClick={() => navigator.clipboard.writeText(text)}
						className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm"
					>
						Copy JSON
					</button>
					<button type="button" onClick={validate} className="rm-btn-primary">
						Save changes
					</button>
				</div>
			)}
		</div>
	);
}

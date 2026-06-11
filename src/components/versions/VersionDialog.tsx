import { formatDistanceToNow } from "date-fns";
import { History, Plus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";

export interface VersionRow {
	_id: string;
	label: string;
	kind: "manual" | "auto";
	_creationTime: number;
}

export function VersionDialog({
	open,
	onOpenChange,
	entityNoun,
	versions,
	onCreate,
	onRestore,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	entityNoun: string;
	versions: VersionRow[] | undefined;
	onCreate: (label: string) => Promise<void>;
	onRestore: (versionId: string) => Promise<void>;
}) {
	const [label, setLabel] = useState("");
	const [confirmId, setConfirmId] = useState<string | null>(null);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Versions
					</Dialog.Title>
					<Dialog.Description className="mt-1 text-xs text-neutral-500">
						Save a checkpoint of the current {entityNoun}, or restore an earlier
						one. A safety checkpoint is saved automatically before any restore.
					</Dialog.Description>

					<div className="mt-4 flex gap-2">
						<input
							className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							placeholder="Version name (optional)"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
						<button
							type="button"
							onClick={async () => {
								await onCreate(label.trim());
								setLabel("");
							}}
							className="flex items-center gap-1 rm-btn-primary"
						>
							<Plus size={14} /> Save
						</button>
					</div>

					<div className="mt-4 max-h-72 space-y-2 overflow-auto">
						{versions === undefined ? (
							<p className="text-sm text-neutral-500">Loading…</p>
						) : versions.length === 0 ? (
							<p className="text-sm text-neutral-500">
								No versions yet. Save one to create a restore point.
							</p>
						) : (
							versions.map((version) => (
								<div
									key={version._id}
									className="flex items-center gap-2 rounded-md border border-neutral-200 p-2"
								>
									<History size={15} className="shrink-0 text-neutral-400" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium">
												{version.label}
											</span>
											<span
												className={
													version.kind === "manual"
														? "rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-white"
														: "rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500"
												}
											>
												{version.kind === "manual" ? "Manual" : "Auto"}
											</span>
										</div>
										<span className="block text-[11px] text-neutral-500">
											{formatDistanceToNow(version._creationTime, {
												addSuffix: true,
											})}
										</span>
									</div>
									{confirmId === version._id ? (
										<div className="flex shrink-0 items-center gap-1">
											<button
												type="button"
												onClick={async () => {
													await onRestore(version._id);
													setConfirmId(null);
													onOpenChange(false);
												}}
												className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setConfirmId(null)}
												className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
											>
												Cancel
											</button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setConfirmId(version._id)}
											className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-100"
										>
											Restore
										</button>
									)}
								</div>
							))
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

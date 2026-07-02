import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Copy, RefreshCw } from "lucide-react";
import { Dialog } from "radix-ui";
import { DialogCloseButton } from "@/components/ui/dialog-close";

export function DiagramShareDialog({
	diagram,
	open,
	onOpenChange,
}: {
	diagram: Doc<"diagrams">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const enableShare = useMutation(api.diagrams.enableShare);
	const disableShare = useMutation(api.diagrams.disableShare);
	const regenerateShare = useMutation(api.diagrams.regenerateShare);
	const shared = diagram.visibility === "link" && Boolean(diagram.shareToken);
	const link =
		shared && typeof window !== "undefined"
			? `${window.location.origin}/share/diagram/${diagram.shareToken}`
			: "";

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<DialogCloseButton />
					<Dialog.Title className="text-base font-semibold">
						Share diagram
					</Dialog.Title>
					<p className="mt-1 text-sm text-neutral-500">
						Anyone with the link can view this diagram (read-only).
					</p>
					{shared ? (
						<div className="mt-4 space-y-3">
							<div className="flex gap-2">
								<input
									readOnly
									value={link}
									className="flex-1 rounded-md border border-neutral-200 px-2 py-2 text-sm"
								/>
								<button
									type="button"
									onClick={() => navigator.clipboard.writeText(link)}
									className="flex items-center gap-1 rounded-md border border-neutral-200 px-3 text-sm"
								>
									<Copy size={14} /> Copy
								</button>
							</div>
							<div className="flex items-center gap-4">
								<button
									type="button"
									onClick={() => regenerateShare({ diagramId: diagram._id })}
									className="flex items-center gap-1 text-sm text-neutral-600"
								>
									<RefreshCw size={14} /> Regenerate link
								</button>
								<button
									type="button"
									onClick={() => disableShare({ diagramId: diagram._id })}
									className="text-sm text-red-600"
								>
									Turn off sharing
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => enableShare({ diagramId: diagram._id })}
							className="mt-4 rm-btn-primary"
						>
							Create share link
						</button>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

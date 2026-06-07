import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Copy } from "lucide-react";
import { Dialog } from "radix-ui";

export function ShareDialog({
	roadmap,
	open,
	onOpenChange,
}: {
	roadmap: Doc<"roadmaps">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const enableShare = useMutation(api.roadmaps.enableShare);
	const disableShare = useMutation(api.roadmaps.disableShare);
	const shared = roadmap.visibility === "link" && Boolean(roadmap.shareToken);
	const link =
		shared && typeof window !== "undefined"
			? `${window.location.origin}/share/${roadmap.shareToken}`
			: "";

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Share roadmap
					</Dialog.Title>
					<p className="mt-1 text-sm text-neutral-500">
						Anyone with the link can view this roadmap (read-only).
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
							<button
								type="button"
								onClick={() =>
									disableShare({ roadmapId: roadmap._id as Id<"roadmaps"> })
								}
								className="text-sm text-red-600"
							>
								Turn off sharing
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() =>
								enableShare({ roadmapId: roadmap._id as Id<"roadmaps"> })
							}
							className="mt-4 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
						>
							Create share link
						</button>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

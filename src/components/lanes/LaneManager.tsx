import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { DialogCloseButton } from "@/components/ui/dialog-close";

export function LaneManager({
	roadmapId,
	lanes,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	lanes: Doc<"lanes">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const createLane = useMutation(api.lanes.create);
	const updateLane = useMutation(api.lanes.update);
	const removeLane = useMutation(api.lanes.remove);
	const [newName, setNewName] = useState("");

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<DialogCloseButton />
					<Dialog.Title className="text-base font-semibold">Lanes</Dialog.Title>
					<div className="mt-4 space-y-2">
						{lanes.map((lane) => (
							<div key={lane._id} className="flex items-center gap-2">
								<input
									className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
									defaultValue={lane.name}
									onBlur={(e) =>
										e.target.value !== lane.name &&
										updateLane({ laneId: lane._id, name: e.target.value })
									}
								/>
								<button
									type="button"
									disabled={lanes.length <= 1 || lane.isDefault}
									title={
										lane.isDefault
											? "The default lane cannot be deleted"
											: "Delete"
									}
									onClick={() => {
										const target = lanes.find((l) => l._id !== lane._id);
										if (target)
											removeLane({
												laneId: lane._id,
												moveToLaneId: target._id,
											});
									}}
									className="text-neutral-500 disabled:opacity-30"
								>
									<Trash2 size={16} />
								</button>
							</div>
						))}
					</div>
					<div className="mt-4 flex gap-2">
						<input
							className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							placeholder="New lane name"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<button
							type="button"
							onClick={async () => {
								if (!newName.trim()) return;
								await createLane({ roadmapId, name: newName.trim() });
								setNewName("");
							}}
							className="flex items-center gap-1 rm-btn-primary"
						>
							<Plus size={14} /> Add
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

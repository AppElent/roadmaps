import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { dateInputToMs, msToDateInput } from "@/lib/fields";

export function MilestoneManager({
	roadmapId,
	milestones,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	milestones: Doc<"milestones">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const createMilestone = useMutation(api.milestones.create);
	const updateMilestone = useMutation(api.milestones.update);
	const removeMilestone = useMutation(api.milestones.remove);
	const [name, setName] = useState("");
	const [date, setDate] = useState("");

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Milestones
					</Dialog.Title>
					<div className="mt-4 space-y-2">
						{milestones.map((m) => (
							<div key={m._id} className="flex items-center gap-2">
								<input
									className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
									defaultValue={m.name}
									onBlur={(e) =>
										e.target.value !== m.name &&
										updateMilestone({
											milestoneId: m._id,
											name: e.target.value,
										})
									}
								/>
								<input
									type="date"
									className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
									defaultValue={msToDateInput(m.date)}
									onChange={(e) =>
										e.target.value &&
										updateMilestone({
											milestoneId: m._id,
											date: dateInputToMs(e.target.value),
										})
									}
								/>
								<button
									type="button"
									onClick={() => removeMilestone({ milestoneId: m._id })}
									className="text-neutral-500"
								>
									<Trash2 size={16} />
								</button>
							</div>
						))}
					</div>
					<div className="mt-4 flex items-end gap-2 border-t border-neutral-200 pt-4">
						<label className="flex-1 text-sm">
							Name
							<input
								className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</label>
						<label className="text-sm">
							Date
							<input
								type="date"
								className="mt-1 rounded-md border border-neutral-200 px-2 py-1.5"
								value={date}
								onChange={(e) => setDate(e.target.value)}
							/>
						</label>
						<button
							type="button"
							onClick={async () => {
								if (!name.trim() || !date) return;
								await createMilestone({
									roadmapId,
									name: name.trim(),
									date: dateInputToMs(date),
								});
								setName("");
								setDate("");
							}}
							className="flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
						>
							<Plus size={14} /> Add
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

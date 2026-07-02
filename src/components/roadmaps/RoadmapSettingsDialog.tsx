import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Dialog } from "radix-ui";
import { DialogCloseButton } from "@/components/ui/dialog-close";
import { dateInputToMs, msToDateInput } from "@/lib/fields";
import type { Zoom } from "@/lib/timeline";

const ZOOMS: Zoom[] = ["week", "month", "quarter", "half"];

export function RoadmapSettingsDialog({
	roadmap,
	fields,
	open,
	onOpenChange,
}: {
	roadmap: Doc<"roadmaps">;
	fields: Doc<"fields">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const update = useMutation(api.roadmaps.update);
	const selectFields = fields.filter(
		(f) => f.type === "select" || f.type === "multiselect",
	);
	const base =
		"mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm";

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<DialogCloseButton />
					<Dialog.Title className="text-base font-semibold">
						Roadmap settings
					</Dialog.Title>
					<label className="block text-sm">
						Name
						<input
							className={base}
							defaultValue={roadmap.name}
							onBlur={(e) =>
								e.target.value !== roadmap.name &&
								update({ roadmapId: roadmap._id, name: e.target.value })
							}
						/>
					</label>
					<div className="grid grid-cols-2 gap-2">
						<label className="block text-sm">
							Start
							<input
								type="date"
								className={base}
								defaultValue={msToDateInput(roadmap.startDate)}
								onChange={(e) =>
									e.target.value &&
									update({
										roadmapId: roadmap._id,
										startDate: dateInputToMs(e.target.value),
									})
								}
							/>
						</label>
						<label className="block text-sm">
							End
							<input
								type="date"
								className={base}
								defaultValue={msToDateInput(roadmap.endDate)}
								onChange={(e) =>
									e.target.value &&
									update({
										roadmapId: roadmap._id,
										endDate: dateInputToMs(e.target.value),
									})
								}
							/>
						</label>
					</div>
					<label className="block text-sm">
						Default zoom
						<select
							className={base}
							defaultValue={roadmap.defaultZoom}
							onChange={(e) =>
								update({
									roadmapId: roadmap._id,
									defaultZoom: e.target.value as Zoom,
								})
							}
						>
							{ZOOMS.map((z) => (
								<option key={z} value={z}>
									{z}
								</option>
							))}
						</select>
					</label>
					<label className="block text-sm">
						Color items by
						<select
							className={base}
							defaultValue={roadmap.colorByFieldKey ?? ""}
							onChange={(e) =>
								update({
									roadmapId: roadmap._id,
									colorByFieldKey: e.target.value,
								})
							}
						>
							{selectFields.map((f) => (
								<option key={f._id} value={f.key}>
									{f.label}
								</option>
							))}
						</select>
					</label>
					<label className="block text-sm">
						Bar color style
						<select
							className={base}
							defaultValue={roadmap.barColorMode ?? "left"}
							onChange={(e) =>
								update({
									roadmapId: roadmap._id,
									barColorMode: e.target.value as "left" | "fill",
								})
							}
						>
							<option value="left">Left line</option>
							<option value="fill">Fill bar</option>
						</select>
					</label>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

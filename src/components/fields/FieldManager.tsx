import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";

const TYPES = ["text", "number", "date", "select", "multiselect"] as const;

function slug(label: string): string {
	return (
		label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_|_$/g, "") || "field"
	);
}

export function FieldManager({
	roadmapId,
	fields,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	fields: Doc<"fields">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const createField = useMutation(api.fields.create);
	const updateField = useMutation(api.fields.update);
	const removeField = useMutation(api.fields.remove);
	const [label, setLabel] = useState("");
	const [type, setType] = useState<(typeof TYPES)[number]>("text");

	async function addField() {
		if (!label.trim()) return;
		const order = fields.reduce((m, f) => Math.max(m, f.order), -1) + 1;
		await createField({
			roadmapId,
			key: `${slug(label)}_${order}`,
			label: label.trim(),
			type,
			options:
				type === "select" || type === "multiselect"
					? [{ id: "option_1", label: "Option 1", color: "#9bc2e0" }]
					: undefined,
			showInTable: true,
			order,
		});
		setLabel("");
		setType("text");
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(560px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Fields
					</Dialog.Title>
					<div className="mt-4 space-y-3">
						{[...fields]
							.sort((a, b) => a.order - b.order)
							.map((field) => (
								<div
									key={field._id}
									className="rounded-md border border-neutral-200 p-3"
								>
									<div className="flex items-center gap-2">
										<input
											className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
											defaultValue={field.label}
											onBlur={(e) =>
												e.target.value !== field.label &&
												updateField({
													fieldId: field._id,
													label: e.target.value,
												})
											}
										/>
										<span className="font-mono text-xs text-neutral-500">
											{field.type}
										</span>
										<label className="flex items-center gap-1 text-xs">
											<input
												type="checkbox"
												defaultChecked={field.showInTable}
												onChange={(e) =>
													updateField({
														fieldId: field._id,
														showInTable: e.target.checked,
													})
												}
											/>
											table
										</label>
										<button
											type="button"
											disabled={field.isSystem}
											title={field.isSystem ? "System field" : "Delete"}
											onClick={() => removeField({ fieldId: field._id })}
											className="text-neutral-500 disabled:opacity-30"
										>
											<Trash2 size={16} />
										</button>
									</div>

									{field.options ? (
										<div className="mt-2 space-y-1">
											{field.options.map((opt, idx) => (
												<div key={opt.id} className="flex items-center gap-2">
													<input
														type="color"
														defaultValue={opt.color}
														onBlur={(e) => {
															const options = field.options?.map((o, i) =>
																i === idx ? { ...o, color: e.target.value } : o,
															);
															updateField({ fieldId: field._id, options });
														}}
													/>
													<input
														className="flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm"
														defaultValue={opt.label}
														onBlur={(e) => {
															const options = field.options?.map((o, i) =>
																i === idx ? { ...o, label: e.target.value } : o,
															);
															updateField({ fieldId: field._id, options });
														}}
													/>
												</div>
											))}
											<button
												type="button"
												onClick={() => {
													const n = (field.options?.length ?? 0) + 1;
													const options = [
														...(field.options ?? []),
														{
															id: `option_${n}`,
															label: `Option ${n}`,
															color: "#cccccc",
														},
													];
													updateField({ fieldId: field._id, options });
												}}
												className="flex items-center gap-1 text-xs text-neutral-600"
											>
												<Plus size={12} /> Add option
											</button>
										</div>
									) : null}
								</div>
							))}
					</div>

					<div className="mt-4 flex items-end gap-2 border-t border-neutral-200 pt-4">
						<label className="flex-1 text-sm">
							New field
							<input
								className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
							/>
						</label>
						<select
							className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							value={type}
							onChange={(e) =>
								setType(e.target.value as (typeof TYPES)[number])
							}
						>
							{TYPES.map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={addField}
							className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
						>
							Add
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

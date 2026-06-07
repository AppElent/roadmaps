import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldValueInput } from "@/components/fields/FieldValueInput";
import {
	dateInputToMs,
	emptyValue,
	type FieldValue,
	msToDateInput,
	validateValues,
} from "@/lib/fields";

type ItemDraft = {
	title: string;
	laneId: Id<"lanes">;
	startMs: number;
	endMs: number;
	description: string;
	values: Record<string, FieldValue>;
};

function draftFromItem(
	item: Doc<"items"> | null,
	fields: Doc<"fields">[],
	defaultLaneId: Id<"lanes">,
	windowStart: number,
): ItemDraft {
	if (item) {
		return {
			title: item.title,
			laneId: item.laneId,
			startMs: item.startDate,
			endMs: item.endDate,
			description: item.description ?? "",
			values: { ...item.values },
		};
	}
	const values: Record<string, FieldValue> = {};
	for (const f of fields) values[f.key] = emptyValue(f);
	const day = 24 * 60 * 60 * 1000;
	return {
		title: "",
		laneId: defaultLaneId,
		startMs: windowStart,
		endMs: windowStart + 30 * day,
		description: "",
		values,
	};
}

export function ItemEditorPanel({
	roadmapId,
	item,
	fields,
	lanes,
	windowStart,
	onClose,
}: {
	roadmapId: Id<"roadmaps">;
	item: Doc<"items"> | null;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	windowStart: number;
	onClose: () => void;
}) {
	const createItem = useMutation(api.items.create);
	const updateItem = useMutation(api.items.update);
	const removeItem = useMutation(api.items.remove);
	const [draft, setDraft] = useState<ItemDraft>(() =>
		draftFromItem(item, fields, lanes[0]._id, windowStart),
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setDraft(draftFromItem(item, fields, lanes[0]._id, windowStart));
		setError(null);
	}, [item, fields, lanes, windowStart]);

	async function save() {
		setError(null);
		let cleanValues: Record<string, FieldValue>;
		try {
			cleanValues = validateValues(fields, draft.values);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Invalid field value");
			return;
		}
		if (!draft.title.trim()) {
			setError("Title is required");
			return;
		}
		if (draft.endMs <= draft.startMs) {
			setError("End must be after start");
			return;
		}
		const payload = {
			title: draft.title.trim(),
			laneId: draft.laneId,
			startDate: draft.startMs,
			endDate: draft.endMs,
			description: draft.description || undefined,
			values: cleanValues,
		};
		if (item) {
			await updateItem({ itemId: item._id, ...payload });
		} else {
			await createItem({ roadmapId, ...payload });
		}
		onClose();
	}

	const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	return (
		<div className="fixed inset-y-0 right-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-neutral-200 bg-white shadow-xl">
			<div className="flex items-center justify-between border-b border-neutral-200 p-4">
				<h2 className="text-sm font-semibold">
					{item ? "Edit item" : "New item"}
				</h2>
				<button type="button" onClick={onClose} aria-label="Close">
					<X size={18} />
				</button>
			</div>

			<div className="flex-1 space-y-3 overflow-auto p-4">
				<label className="block text-sm">
					Title
					<input
						className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
						value={draft.title}
						onChange={(e) => set("title", e.target.value)}
					/>
				</label>

				<label className="block text-sm">
					Lane
					<select
						className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
						value={draft.laneId}
						onChange={(e) => set("laneId", e.target.value as Id<"lanes">)}
					>
						{lanes.map((l) => (
							<option key={l._id} value={l._id}>
								{l.name}
							</option>
						))}
					</select>
				</label>

				<div className="grid grid-cols-2 gap-2">
					<label className="block text-sm">
						Start
						<input
							type="date"
							className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
							value={msToDateInput(draft.startMs)}
							onChange={(e) => set("startMs", dateInputToMs(e.target.value))}
						/>
					</label>
					<label className="block text-sm">
						End
						<input
							type="date"
							className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
							value={msToDateInput(draft.endMs)}
							onChange={(e) => set("endMs", dateInputToMs(e.target.value))}
						/>
					</label>
				</div>

				{fields.map((f) => (
					<div key={f._id} className="block text-sm">
						<span className="text-neutral-700">{f.label}</span>
						<div className="mt-1">
							<FieldValueInput
								field={f}
								value={draft.values[f.key] ?? emptyValue(f)}
								onChange={(next) =>
									setDraft((d) => ({
										...d,
										values: { ...d.values, [f.key]: next },
									}))
								}
							/>
						</div>
					</div>
				))}

				<label className="block text-sm">
					Description
					<textarea
						className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
						rows={4}
						value={draft.description}
						onChange={(e) => set("description", e.target.value)}
					/>
				</label>

				{error ? <p className="text-xs text-red-600">{error}</p> : null}
			</div>

			<div className="flex items-center justify-between border-t border-neutral-200 p-4">
				{item ? (
					<button
						type="button"
						onClick={async () => {
							await removeItem({ itemId: item._id });
							onClose();
						}}
						className="flex items-center gap-1 text-xs text-red-600"
					>
						<Trash2 size={14} /> Delete
					</button>
				) : (
					<span />
				)}
				<button type="button" onClick={save} className="rm-btn-primary">
					{item ? "Save" : "Create"}
				</button>
			</div>
		</div>
	);
}

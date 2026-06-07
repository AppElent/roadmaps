import type { Doc } from "@convex/_generated/dataModel";
import type { ItemFilter } from "@/lib/itemQuery";

export function FilterBar({
	lanes,
	fields,
	filter,
	onChange,
}: {
	lanes: Doc<"lanes">[];
	fields: Doc<"fields">[];
	filter: ItemFilter;
	onChange: (next: ItemFilter) => void;
}) {
	const selectFields = fields.filter(
		(f) => f.type === "select" || f.type === "multiselect",
	);
	const activeField = selectFields.find((f) => f.key === filter.fieldKey);
	const base = "rounded-md border border-neutral-200 px-2 py-2 text-sm";

	return (
		<div className="flex flex-wrap items-end gap-2 border-b border-neutral-200 bg-white p-3">
			<input
				className={`${base} min-w-48 flex-1`}
				placeholder="Search items"
				value={filter.search}
				onChange={(e) => onChange({ ...filter, search: e.target.value })}
			/>
			<select
				className={base}
				value={filter.laneId}
				onChange={(e) =>
					onChange({
						...filter,
						laneId: e.target.value as ItemFilter["laneId"],
					})
				}
			>
				<option value="all">All lanes</option>
				{lanes.map((l) => (
					<option key={l._id} value={l._id}>
						{l.name}
					</option>
				))}
			</select>
			<select
				className={base}
				value={filter.fieldKey ?? ""}
				onChange={(e) =>
					onChange({
						...filter,
						fieldKey: e.target.value || null,
						optionId: "all",
					})
				}
			>
				<option value="">No field filter</option>
				{selectFields.map((f) => (
					<option key={f._id} value={f.key}>
						{f.label}
					</option>
				))}
			</select>
			{activeField ? (
				<select
					className={base}
					value={filter.optionId}
					onChange={(e) => onChange({ ...filter, optionId: e.target.value })}
				>
					<option value="all">Any {activeField.label}</option>
					{(activeField.options ?? []).map((o) => (
						<option key={o.id} value={o.id}>
							{o.label}
						</option>
					))}
				</select>
			) : null}
			<button
				type="button"
				onClick={() =>
					onChange({
						search: "",
						laneId: "all",
						fieldKey: null,
						optionId: "all",
					})
				}
				className="text-xs text-neutral-500"
			>
				Clear
			</button>
		</div>
	);
}

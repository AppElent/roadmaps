import {
	dateInputToMs,
	type FieldDef,
	type FieldValue,
	msToDateInput,
} from "@/lib/fields";

export function FieldValueInput({
	field,
	value,
	onChange,
}: {
	field: FieldDef;
	value: FieldValue;
	onChange: (next: FieldValue) => void;
}) {
	const base = "w-full rounded-md border border-neutral-200 px-2 py-2 text-sm";

	if (field.type === "text") {
		return (
			<input
				className={base}
				value={typeof value === "string" ? value : ""}
				onChange={(e) => onChange(e.target.value || null)}
			/>
		);
	}
	if (field.type === "number") {
		return (
			<input
				type="number"
				className={base}
				value={typeof value === "number" ? value : ""}
				onChange={(e) =>
					onChange(e.target.value === "" ? null : Number(e.target.value))
				}
			/>
		);
	}
	if (field.type === "date") {
		return (
			<input
				type="date"
				className={base}
				value={typeof value === "number" ? msToDateInput(value) : ""}
				onChange={(e) =>
					onChange(e.target.value ? dateInputToMs(e.target.value) : null)
				}
			/>
		);
	}
	if (field.type === "select") {
		return (
			<select
				className={base}
				value={typeof value === "string" ? value : ""}
				onChange={(e) => onChange(e.target.value || null)}
			>
				<option value="">—</option>
				{(field.options ?? []).map((o) => (
					<option key={o.id} value={o.id}>
						{o.label}
					</option>
				))}
			</select>
		);
	}
	// multiselect
	const selected = Array.isArray(value) ? value : [];
	return (
		<div className="flex flex-wrap gap-1">
			{(field.options ?? []).map((o) => {
				const on = selected.includes(o.id);
				return (
					<button
						key={o.id}
						type="button"
						onClick={() =>
							onChange(
								on ? selected.filter((id) => id !== o.id) : [...selected, o.id],
							)
						}
						style={{ borderColor: o.color }}
						className={`rounded-full border px-2 py-0.5 text-xs ${
							on ? "bg-neutral-100" : "opacity-60"
						}`}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}

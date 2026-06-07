import type { Doc } from "@convex/_generated/dataModel";
import { z } from "zod";

export type FieldDef = Doc<"fields">;
export type FieldValue = string | number | string[] | null;

function optionIds(field: FieldDef): string[] {
	return (field.options ?? []).map((o) => o.id);
}

function schemaForField(field: FieldDef): z.ZodTypeAny {
	switch (field.type) {
		case "text":
			return z.string();
		case "number":
			return z.number();
		case "date":
			return z.number();
		case "select": {
			const ids = optionIds(field);
			return z
				.string()
				.refine((v) => ids.includes(v), `Invalid option for ${field.label}`);
		}
		case "multiselect": {
			const ids = optionIds(field);
			return z.array(
				z
					.string()
					.refine((v) => ids.includes(v), `Invalid option for ${field.label}`),
			);
		}
	}
}

/** Validates and cleans an item's custom values against the roadmap's fields. */
export function validateValues(
	fields: FieldDef[],
	values: Record<string, unknown>,
): Record<string, FieldValue> {
	const out: Record<string, FieldValue> = {};
	for (const field of fields) {
		const raw = values[field.key];
		if (raw === undefined || raw === null || raw === "") continue;
		out[field.key] = schemaForField(field).parse(raw) as FieldValue;
	}
	return out;
}

export function emptyValue(field: FieldDef): FieldValue {
	return field.type === "multiselect" ? [] : null;
}

/** ms timestamp -> "yyyy-MM-dd" for <input type="date">. */
export function msToDateInput(ms: number): string {
	const d = new Date(ms);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "yyyy-MM-dd" -> ms timestamp (local midnight). */
export function dateInputToMs(value: string): number {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d).getTime();
}

/** Formats a value for display in a table cell or chip. */
export function displayValue(field: FieldDef, value: FieldValue): string {
	if (value === null || value === undefined || value === "") return "";
	if (field.type === "date" && typeof value === "number") {
		return msToDateInput(value);
	}
	const labelOf = (id: string) =>
		field.options?.find((o) => o.id === id)?.label ?? id;
	if (field.type === "select" && typeof value === "string")
		return labelOf(value);
	if (field.type === "multiselect" && Array.isArray(value)) {
		return value.map(labelOf).join(", ");
	}
	return String(value);
}

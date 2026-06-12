import type { Doc } from "@convex/_generated/dataModel";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { displayValue, msToDateInput } from "@/lib/fields";
import type { SortState } from "@/lib/itemQuery";

export function ItemTable({
	items,
	fields,
	lanes,
	sort,
	onSortChange,
	onSelect,
}: {
	items: Doc<"items">[];
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	sort: SortState;
	onSortChange: (next: SortState) => void;
	onSelect: (id: Doc<"items">["_id"]) => void;
}) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const tableFields = fields
		.filter((f) => f.showInTable)
		.sort((a, b) => a.order - b.order);
	const laneName = (id: Doc<"items">["laneId"]) =>
		lanes.find((l) => l._id === id)?.name ?? "";

	const columns = [
		{ key: "title", label: "Item" },
		{ key: "laneId", label: "Lane" },
		...tableFields.map((f) => ({ key: f.key, label: f.label })),
		{ key: "startDate", label: "Start" },
		{ key: "endDate", label: "End" },
	];

	const isDateKey = (key: string) => key === "startDate" || key === "endDate";

	const renderValue = (key: string, item: Doc<"items">): ReactNode => {
		if (key === "laneId") return laneName(item.laneId);
		if (key === "startDate") return msToDateInput(item.startDate);
		if (key === "endDate") return msToDateInput(item.endDate);
		const field = tableFields.find((f) => f.key === key);
		if (field) return displayValue(field, item.values[field.key] ?? null);
		return null;
	};

	const toggleSort = (key: string) =>
		onSortChange({
			key,
			dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : 1,
		});

	const toggleExpand = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const Th = ({ k, label }: { k: string; label: string }) => (
		<th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-neutral-500">
			<button
				type="button"
				onClick={() => toggleSort(k)}
				className="inline-flex items-center gap-1"
			>
				{label}
				{sort.key === k ? <span>{sort.dir === 1 ? "▲" : "▼"}</span> : null}
			</button>
		</th>
	);

	const colCount = 2 + columns.length;
	const labelClass =
		"font-mono text-[11px] uppercase tracking-wide text-neutral-500";

	return (
		<>
			{/* Mobile: stacked cards */}
			<div className="space-y-3 sm:hidden">
				<div className="flex items-center gap-2">
					<Select value={sort.key} onValueChange={(key) => toggleSort(key)}>
						<SelectTrigger size="sm" className="flex-1">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							{columns.map((col) => (
								<SelectItem key={col.key} value={col.key}>
									{col.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<button
						type="button"
						aria-label="Toggle sort direction"
						onClick={() => toggleSort(sort.key)}
						className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-sm text-neutral-600"
					>
						{sort.dir === 1 ? "▲" : "▼"}
					</button>
				</div>

				{items.map((item) => {
					const isOpen = expanded.has(item._id);
					return (
						<div
							key={item._id}
							className="rounded-lg border border-neutral-200 bg-white p-3"
						>
							<div className="flex items-start justify-between gap-2">
								<button
									type="button"
									onClick={() => onSelect(item._id)}
									className="text-left font-medium hover:underline"
								>
									{item.title}
								</button>
								{item.description ? (
									<button
										type="button"
										aria-label="Toggle description"
										onClick={() => toggleExpand(item._id)}
										className="shrink-0 text-neutral-500"
									>
										{isOpen ? (
											<ChevronDown size={16} />
										) : (
											<ChevronRight size={16} />
										)}
									</button>
								) : null}
							</div>
							{isOpen && item.description ? (
								<p className="mt-2 text-sm text-neutral-600">
									{item.description}
								</p>
							) : null}
							<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
								{columns
									.filter((col) => col.key !== "title")
									.map((col) => (
										<Fragment key={col.key}>
											<dt className={`${labelClass} py-0.5`}>{col.label}</dt>
											<dd
												className={`text-sm text-neutral-700 ${
													isDateKey(col.key) ? "font-mono text-xs" : ""
												}`}
											>
												{renderValue(col.key, item)}
											</dd>
										</Fragment>
									))}
							</dl>
						</div>
					);
				})}
			</div>

			{/* Desktop: table */}
			<div className="hidden overflow-auto rounded-lg border border-neutral-200 bg-white sm:block">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr>
							<th className="w-8 border-b border-neutral-200 bg-neutral-50" />
							{columns.map((col) => (
								<Th key={col.key} k={col.key} label={col.label} />
							))}
						</tr>
					</thead>
					<tbody>
						{items.map((item) => {
							const isOpen = expanded.has(item._id);
							return (
								<Fragment key={item._id}>
									<tr className="hover:bg-neutral-50">
										<td className="px-2">
											{item.description ? (
												<button
													type="button"
													aria-label="Toggle description"
													onClick={() => toggleExpand(item._id)}
												>
													{isOpen ? (
														<ChevronDown size={14} />
													) : (
														<ChevronRight size={14} />
													)}
												</button>
											) : null}
										</td>
										<td className="border-b border-neutral-100 px-3 py-2">
											<button
												type="button"
												onClick={() => onSelect(item._id)}
												className="text-left font-medium hover:underline"
											>
												{item.title}
											</button>
										</td>
										<td className="border-b border-neutral-100 px-3 py-2">
											{laneName(item.laneId)}
										</td>
										{tableFields.map((f) => (
											<td
												key={f._id}
												className="border-b border-neutral-100 px-3 py-2"
											>
												{displayValue(f, item.values[f.key] ?? null)}
											</td>
										))}
										<td className="border-b border-neutral-100 px-3 py-2 font-mono text-xs">
											{msToDateInput(item.startDate)}
										</td>
										<td className="border-b border-neutral-100 px-3 py-2 font-mono text-xs">
											{msToDateInput(item.endDate)}
										</td>
									</tr>
									{isOpen ? (
										<tr>
											<td />
											<td
												colSpan={colCount - 1}
												className="border-b border-neutral-100 px-3 pb-3 text-sm text-neutral-600"
											>
												{item.description}
											</td>
										</tr>
									) : null}
								</Fragment>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
}

import type { Doc } from "@convex/_generated/dataModel";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
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

	const colCount = 4 + tableFields.length;

	return (
		<div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr>
						<th className="w-8 border-b border-neutral-200 bg-neutral-50" />
						<Th k="title" label="Item" />
						<Th k="laneId" label="Lane" />
						{tableFields.map((f) => (
							<Th key={f._id} k={f.key} label={f.label} />
						))}
						<Th k="startDate" label="Start" />
						<Th k="endDate" label="End" />
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
	);
}

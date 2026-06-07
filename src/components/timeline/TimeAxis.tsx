import type { Period } from "@/lib/timeline";

export function TimeAxis({
	periods,
	columnWidth,
	labelWidth,
}: {
	periods: Period[];
	columnWidth: number;
	labelWidth: number;
}) {
	return (
		<div className="sticky top-0 z-10 flex border-b border-neutral-200 bg-neutral-50">
			<div
				style={{ width: labelWidth }}
				className="shrink-0 border-r border-neutral-200"
			/>
			{periods.map((p) => (
				<div
					key={p.start}
					style={{ width: columnWidth }}
					className="shrink-0 border-r border-neutral-200 px-2 py-2 font-mono text-[11px] uppercase tracking-wide text-neutral-500"
				>
					{p.label}
				</div>
			))}
		</div>
	);
}

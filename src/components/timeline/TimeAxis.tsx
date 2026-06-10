import { type Period, yearBands } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export function TimeAxis({
	periods,
	columnWidth,
	labelWidth,
}: {
	periods: Period[];
	columnWidth: number;
	labelWidth: number;
}) {
	const bands = yearBands(periods);
	return (
		<div className="sticky top-0 z-10 bg-neutral-50">
			<div className="flex border-b border-neutral-200">
				<div
					style={{ width: labelWidth }}
					className="shrink-0 border-r border-neutral-200"
				/>
				{bands.map((b, i) => (
					<div
						key={b.label}
						style={{ width: b.columnSpan * columnWidth }}
						className={cn(
							"shrink-0 border-r border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-500",
							i > 0 && "border-l-2 border-l-neutral-300",
						)}
					>
						{b.label}
					</div>
				))}
			</div>
			<div className="flex border-b border-neutral-200">
				<div
					style={{ width: labelWidth }}
					className="shrink-0 border-r border-neutral-200"
				/>
				{periods.map((p, idx) => {
					const newYear =
						idx > 0 &&
						new Date(p.start).getFullYear() !==
							new Date(periods[idx - 1].start).getFullYear();
					return (
						<div
							key={p.start}
							style={{ width: columnWidth }}
							className={cn(
								"shrink-0 border-r border-neutral-200 px-2 py-2 font-mono text-[11px] uppercase tracking-wide text-neutral-500",
								newYear && "border-l-2 border-l-neutral-400",
							)}
						>
							{p.label}
						</div>
					);
				})}
			</div>
		</div>
	);
}

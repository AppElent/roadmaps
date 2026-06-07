import type { Zoom } from "@/lib/timeline";

const ZOOMS: Zoom[] = ["week", "month", "quarter", "half"];

export function ZoomSwitch({
	value,
	onChange,
}: {
	value: Zoom;
	onChange: (z: Zoom) => void;
}) {
	return (
		<div className="inline-flex overflow-hidden rounded-md border border-neutral-200">
			{ZOOMS.map((z) => (
				<button
					key={z}
					type="button"
					onClick={() => onChange(z)}
					className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
						z === value ? "bg-neutral-100 text-neutral-900" : "text-neutral-500"
					}`}
				>
					{z}
				</button>
			))}
		</div>
	);
}

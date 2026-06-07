import { Archive, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RoadmapCardProps {
	name: string;
	itemCount: number;
	updatedLabel: string;
	className?: string;
	onOpen: () => void;
	onDuplicate: () => void;
	onArchive: () => void;
}

export function RoadmapCard({
	name,
	itemCount,
	updatedLabel,
	className,
	onOpen,
	onDuplicate,
	onArchive,
}: RoadmapCardProps) {
	return (
		<div
			className={cn(
				"group flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400",
				className,
			)}
		>
			<button type="button" onClick={onOpen} className="text-left">
				<strong className="text-sm">{name}</strong>
				<p className="mt-1 font-mono text-xs text-neutral-500">
					updated {updatedLabel} / {itemCount} items
				</p>
			</button>
			<div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
				<button
					type="button"
					onClick={onDuplicate}
					className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs"
				>
					<Copy size={12} /> Duplicate
				</button>
				<button
					type="button"
					onClick={onArchive}
					className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs"
				>
					<Archive size={12} /> Archive
				</button>
			</div>
		</div>
	);
}

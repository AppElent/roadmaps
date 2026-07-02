import { Archive, ArchiveRestore, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RoadmapCardProps {
	name: string;
	itemCount: number;
	updatedLabel: string;
	className?: string;
	archived?: boolean;
	onOpen: () => void;
	onDuplicate: () => void;
	onArchive: () => void;
	onUnarchive?: () => void;
}

export function RoadmapCard({
	name,
	itemCount,
	updatedLabel,
	className,
	archived = false,
	onOpen,
	onDuplicate,
	onArchive,
	onUnarchive,
}: RoadmapCardProps) {
	return (
		<div
			className={cn(
				"group relative flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600",
				className,
			)}
		>
			{/* Full-card click target: a transparent overlay button that fills the
			    card so the whole hover-highlighted area opens the roadmap. Action
			    buttons below sit above it via relative + z-10. */}
			<button
				type="button"
				onClick={onOpen}
				aria-label={`Open ${name}`}
				className="absolute inset-0 z-0 rounded-lg"
			/>
			<div className="pointer-events-none relative z-10">
				<strong className="text-sm">{name}</strong>
				<p className="mt-1 font-mono text-xs text-neutral-500">
					updated {updatedLabel} / {itemCount} items
				</p>
			</div>
			<div className="relative z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
				{archived ? (
					<button
						type="button"
						onClick={onUnarchive}
						className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-700"
					>
						<ArchiveRestore size={12} /> Unarchive
					</button>
				) : (
					<>
						<button
							type="button"
							onClick={onDuplicate}
							className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-700"
						>
							<Copy size={12} /> Duplicate
						</button>
						<button
							type="button"
							onClick={onArchive}
							className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-700"
						>
							<Archive size={12} /> Archive
						</button>
					</>
				)}
			</div>
		</div>
	);
}

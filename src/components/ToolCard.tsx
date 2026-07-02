import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolCardProps {
	title: string;
	description: string;
	icon: LucideIcon;
	status: "active" | "soon";
	onOpen?: () => void;
}

export function ToolCard({
	title,
	description,
	icon: Icon,
	status,
	onOpen,
}: ToolCardProps) {
	const inner = (
		<>
			<div className="flex items-center gap-2">
				<div className="grid size-8 place-items-center rounded-md border border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
					<Icon size={16} />
				</div>
				<strong className="text-sm">{title}</strong>
				{status === "soon" && (
					<span className="ml-auto rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
						Soon
					</span>
				)}
			</div>
			<p className="mt-1 text-xs text-neutral-500">{description}</p>
		</>
	);

	if (status === "soon") {
		return (
			<div
				className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4 opacity-60 dark:border-neutral-800 dark:bg-neutral-900"
				aria-disabled="true"
			>
				{inner}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={onOpen}
			className={cn(
				"flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4 text-left hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600",
			)}
		>
			{inner}
		</button>
	);
}

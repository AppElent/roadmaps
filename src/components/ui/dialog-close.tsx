import { X } from "lucide-react";
import { Dialog } from "radix-ui";

import { cn } from "#/lib/utils.ts";

/**
 * Shared close (X) button for Radix `Dialog`-based modals. Render as the first
 * child of `Dialog.Content` (which is `position: fixed`, so this anchors to its
 * top-right corner). Closes the dialog via `Dialog.Close` in addition to the
 * existing Escape / backdrop-click behavior.
 */
export function DialogCloseButton({ className }: { className?: string }) {
	return (
		<Dialog.Close
			aria-label="Close"
			className={cn(
				"absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
				className,
			)}
		>
			<X size={16} />
		</Dialog.Close>
	);
}

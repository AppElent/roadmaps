import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

export function BottomTabBar() {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-neutral-200 bg-white sm:hidden">
			<Link
				to="/dashboard"
				className="flex flex-col items-center gap-1 text-xs text-neutral-500 [&.active]:text-neutral-900"
			>
				<LayoutDashboard size={20} /> Dashboard
			</Link>
		</nav>
	);
}

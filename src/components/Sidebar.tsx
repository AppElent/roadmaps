import { UserButton } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Map } from "lucide-react";

export function Sidebar() {
	return (
		<aside className="hidden w-60 flex-col gap-4 border-r border-neutral-200 bg-white p-4 sm:flex">
			<div className="flex items-center gap-2 border-b border-neutral-200 px-1 pb-3">
				<div className="grid size-7 place-items-center rounded-md border border-neutral-900 font-mono text-xs font-bold">
					RM
				</div>
				<strong className="text-sm">Roadmaps</strong>
			</div>
			<nav className="flex flex-col gap-1">
				<Link
					to="/dashboard"
					className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100 [&.active]:bg-neutral-100 [&.active]:text-neutral-900"
				>
					<LayoutDashboard size={16} /> Dashboard
				</Link>
			</nav>
			<div className="mt-auto flex items-center gap-2 px-1">
				<UserButton />
				<span className="font-mono text-xs text-neutral-500">Account</span>
				<Map size={14} className="ml-auto text-neutral-300" />
			</div>
		</aside>
	);
}

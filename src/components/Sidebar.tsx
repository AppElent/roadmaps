import { UserButton } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { Home, Map as MapIcon, Workflow } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const navLinkClass =
	"flex items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100 [&.active]:bg-neutral-100 [&.active]:text-neutral-900";

export function Sidebar() {
	return (
		<aside className="hidden w-60 flex-col gap-4 border-r border-neutral-200 bg-white p-4 sm:flex">
			<div className="flex items-center gap-2 border-b border-neutral-200 px-1 pb-3">
				<div className="grid size-7 place-items-center rounded-md border border-neutral-900 font-mono text-xs font-bold">
					AS
				</div>
				<strong className="text-sm">ArchStudio</strong>
			</div>
			<nav className="flex flex-col gap-1">
				<Link to="/dashboard" className={navLinkClass}>
					<Home size={16} /> Home
				</Link>
				<Link to="/roadmaps" className={navLinkClass}>
					<MapIcon size={16} /> Roadmaps
				</Link>
				<Link to="/diagrams" className={navLinkClass}>
					<Workflow size={16} /> Diagrams
					<span className="ml-auto rounded-full border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
						Soon
					</span>
				</Link>
			</nav>
			<div className="mt-auto flex items-center gap-2 px-1">
				<UserButton />
				<span className="rm-label">Account</span>
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</div>
		</aside>
	);
}

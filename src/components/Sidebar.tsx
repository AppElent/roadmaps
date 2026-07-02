import { HeaderUser } from "@appelent/auth";
import { Link } from "@tanstack/react-router";
import { Home, Map as MapIcon, Workflow } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const navLinkClass =
	"flex items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100 [&.active]:bg-neutral-100 [&.active]:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:[&.active]:bg-neutral-800 dark:[&.active]:text-neutral-100";

export function Sidebar() {
	return (
		<aside className="hidden w-60 flex-col gap-4 border-r border-neutral-200 bg-white p-4 sm:flex dark:border-neutral-800 dark:bg-neutral-900">
			<div className="flex items-center gap-2 border-b border-neutral-200 px-1 pb-3 dark:border-neutral-800">
				<div className="grid size-7 place-items-center rounded-md border border-neutral-900 font-mono text-xs font-bold dark:border-neutral-100">
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
				</Link>
			</nav>
			<div className="mt-auto flex items-center gap-2 px-1">
				<HeaderUser />
				<Link to="/account" className={navLinkClass}>
					Account
				</Link>
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</div>
		</aside>
	);
}

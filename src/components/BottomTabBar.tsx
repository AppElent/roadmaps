import { Link } from "@tanstack/react-router";
import { Home, Map as MapIcon, UserCircle, Workflow } from "lucide-react";

const tabClass =
	"flex flex-col items-center gap-1 text-xs text-neutral-500 [&.active]:text-neutral-900 dark:text-neutral-400 dark:[&.active]:text-neutral-100";

export function BottomTabBar() {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-neutral-200 bg-white sm:hidden dark:border-neutral-800 dark:bg-neutral-900">
			<Link to="/dashboard" className={tabClass}>
				<Home size={20} /> Home
			</Link>
			<Link to="/roadmaps" className={tabClass}>
				<MapIcon size={20} /> Roadmaps
			</Link>
			<Link to="/diagrams" className={tabClass}>
				<Workflow size={20} /> Diagrams
			</Link>
			<Link to="/account" className={tabClass}>
				<UserCircle size={20} /> Account
			</Link>
		</nav>
	);
}

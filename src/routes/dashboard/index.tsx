import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Map as MapIcon, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ToolCard } from "@/components/ToolCard";

export const Route = createFileRoute("/dashboard/")({
	ssr: false,
	component: HomePage,
});

function HomePage() {
	const navigate = useNavigate();

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6">
					<p className="rm-label">Workspace</p>
					<h1 className="text-2xl font-semibold">ArchStudio</h1>
					<p className="mt-1 text-sm text-neutral-500">
						The architect's workbench. Pick a tool to get started.
					</p>
				</header>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<ToolCard
						title="Roadmaps"
						description="Plan initiatives across lanes and timeframes, in real time."
						icon={MapIcon}
						status="active"
						onOpen={() => navigate({ to: "/roadmaps" })}
					/>
					<ToolCard
						title="Diagrams"
						description="Live Mermaid and PlantUML editing."
						icon={Workflow}
						status="active"
						onOpen={() => navigate({ to: "/diagrams" })}
					/>
				</div>
			</div>
		</AppShell>
	);
}

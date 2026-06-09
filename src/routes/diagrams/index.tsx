import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/diagrams/")({
	ssr: false,
	component: DiagramsPage,
});

function DiagramsPage() {
	return (
		<AppShell>
			<div className="grid min-h-[60vh] place-items-center p-6">
				<div className="max-w-sm text-center">
					<div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg border border-neutral-200 text-neutral-500">
						<Workflow size={20} />
					</div>
					<h1 className="mb-1 text-lg font-semibold">
						Diagrams are coming soon
					</h1>
					<p className="text-sm text-neutral-500">
						Live Mermaid and PlantUML editing will live here.
					</p>
				</div>
			</div>
		</AppShell>
	);
}

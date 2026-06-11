import { api } from "@convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Trash2, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreateDiagramDialog } from "@/components/diagrams/CreateDiagramDialog";
import { DIAGRAM_ENGINES } from "@/lib/diagramEngines";

export const Route = createFileRoute("/diagrams/")({
	ssr: false,
	component: DiagramsPage,
});

function DiagramsPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useConvexAuth();
	const diagrams = useQuery(api.diagrams.list, isAuthenticated ? {} : "skip");
	const create = useMutation(api.diagrams.create);
	const remove = useMutation(api.diagrams.remove);

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6 flex items-center justify-between">
					<div>
						<p className="rm-label">Diagrams</p>
						<h1 className="text-2xl font-semibold">Your diagrams</h1>
					</div>
					<CreateDiagramDialog
						onCreate={async (input) => {
							const id = await create(input);
							await navigate({ to: "/diagrams/$id", params: { id } });
						}}
					/>
				</header>

				{diagrams === undefined ? (
					<p className="text-sm text-neutral-500">Loading…</p>
				) : diagrams.length === 0 ? (
					<p className="text-sm text-neutral-500">
						No diagrams yet. Create your first one.
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{diagrams.map((d) => (
							<div
								key={d._id}
								className="rounded-lg border border-neutral-200 bg-white p-4"
							>
								<button
									type="button"
									onClick={() =>
										navigate({ to: "/diagrams/$id", params: { id: d._id } })
									}
									className="flex w-full items-start gap-2 text-left"
								>
									<Workflow size={18} className="mt-0.5 text-neutral-400" />
									<span className="min-w-0">
										<span className="block truncate font-medium">
											{d.title}
										</span>
										<span className="block text-xs text-neutral-500">
											{DIAGRAM_ENGINES[d.type].label} ·{" "}
											{new Date(d._creationTime).toLocaleDateString()}
										</span>
									</span>
								</button>
								<div className="mt-3 flex justify-end">
									<button
										type="button"
										onClick={async () => {
											if (window.confirm(`Delete "${d.title}"?`)) {
												await remove({ diagramId: d._id });
											}
										}}
										className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs text-red-600 hover:bg-neutral-100"
									>
										<Trash2 size={12} /> Delete
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</AppShell>
	);
}

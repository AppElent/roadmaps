import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CreateRoadmapDialog } from "@/components/roadmaps/CreateRoadmapDialog";
import { RoadmapCard } from "@/components/roadmaps/RoadmapCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roadmaps/")({
	ssr: false,
	component: RoadmapsPage,
});

function RoadmapsPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useConvexAuth();
	const [showArchived, setShowArchived] = useState(false);
	const roadmaps = useQuery(
		api.roadmaps.list,
		isAuthenticated ? { archived: showArchived } : "skip",
	);
	const create = useMutation(api.roadmaps.create);
	const duplicate = useMutation(api.roadmaps.duplicate);
	const archive = useMutation(api.roadmaps.archive);

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6 flex items-center justify-between gap-4">
					<div>
						<p className="rm-label">Roadmaps</p>
						<h1 className="text-2xl font-semibold">
							{showArchived ? "Archived roadmaps" : "Your roadmaps"}
						</h1>
					</div>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => setShowArchived((v) => !v)}
							className={cn(
								"rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500",
								showArchived && "bg-neutral-100 dark:bg-neutral-800",
							)}
						>
							{showArchived ? "Show active" : "Show archived"}
						</button>
						<CreateRoadmapDialog
							onCreate={async (input) => {
								const id = await create(input);
								await navigate({ to: "/roadmaps/$id", params: { id } });
							}}
						/>
					</div>
				</header>

				{roadmaps === undefined ? (
					<p className="text-sm text-neutral-500">Loading…</p>
				) : roadmaps.length === 0 ? (
					<p className="text-sm text-neutral-500">
						{showArchived
							? "No archived roadmaps."
							: "No roadmaps yet. Create your first one."}
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{roadmaps.map((r) => (
							<RoadmapCard
								key={r._id}
								name={r.name}
								itemCount={r.itemCount}
								updatedLabel={new Date(r._creationTime).toLocaleDateString()}
								archived={showArchived}
								onOpen={() =>
									navigate({ to: "/roadmaps/$id", params: { id: r._id } })
								}
								onDuplicate={async () => {
									await duplicate({ roadmapId: r._id as Id<"roadmaps"> });
								}}
								onArchive={async () => {
									await archive({ roadmapId: r._id, archived: true });
								}}
								onUnarchive={async () => {
									await archive({ roadmapId: r._id, archived: false });
								}}
							/>
						))}
					</div>
				)}
			</div>
		</AppShell>
	);
}

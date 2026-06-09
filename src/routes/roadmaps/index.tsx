import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AppShell } from "@/components/AppShell";
import { CreateRoadmapDialog } from "@/components/roadmaps/CreateRoadmapDialog";
import { RoadmapCard } from "@/components/roadmaps/RoadmapCard";

export const Route = createFileRoute("/roadmaps/")({
	ssr: false,
	component: RoadmapsPage,
});

function RoadmapsPage() {
	const navigate = useNavigate();
	const roadmaps = useQuery(api.roadmaps.list);
	const create = useMutation(api.roadmaps.create);
	const duplicate = useMutation(api.roadmaps.duplicate);
	const archive = useMutation(api.roadmaps.archive);

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6 flex items-center justify-between">
					<div>
						<p className="rm-label">Roadmaps</p>
						<h1 className="text-2xl font-semibold">Your roadmaps</h1>
					</div>
					<CreateRoadmapDialog
						onCreate={async (input) => {
							const id = await create(input);
							await navigate({ to: "/roadmaps/$id", params: { id } });
						}}
					/>
				</header>

				{roadmaps === undefined ? (
					<p className="text-sm text-neutral-500">Loading…</p>
				) : roadmaps.length === 0 ? (
					<p className="text-sm text-neutral-500">
						No roadmaps yet. Create your first one.
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{roadmaps.map((r) => (
							<RoadmapCard
								key={r._id}
								name={r.name}
								itemCount={r.itemCount}
								updatedLabel={new Date(r._creationTime).toLocaleDateString()}
								onOpen={() =>
									navigate({ to: "/roadmaps/$id", params: { id: r._id } })
								}
								onDuplicate={async () => {
									await duplicate({ roadmapId: r._id as Id<"roadmaps"> });
								}}
								onArchive={async () => {
									await archive({ roadmapId: r._id, archived: true });
								}}
							/>
						))}
					</div>
				)}
			</div>
		</AppShell>
	);
}

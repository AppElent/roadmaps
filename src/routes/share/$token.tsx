import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ReadOnlyRoadmap } from "@/components/share/ReadOnlyRoadmap";

export const Route = createFileRoute("/share/$token")({
	ssr: false,
	component: SharePage,
});

function SharePage() {
	const { token } = Route.useParams();
	const bundle = useQuery(api.sharing.getPublicRoadmap, { shareToken: token });

	if (bundle === undefined) {
		return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
	}
	if (bundle === null) {
		return (
			<div className="grid min-h-screen place-items-center p-6 text-center">
				<div>
					<h1 className="text-lg font-semibold">Roadmap not available</h1>
					<p className="text-sm text-neutral-500">
						This link is invalid or sharing was turned off.
					</p>
				</div>
			</div>
		);
	}
	return (
		<div className="min-h-screen bg-neutral-50 text-neutral-900">
			<ReadOnlyRoadmap bundle={bundle} />
		</div>
	);
}

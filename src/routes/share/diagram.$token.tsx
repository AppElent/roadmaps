import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { DiagramPreview } from "@/components/diagrams/DiagramPreview";

export const Route = createFileRoute("/share/diagram/$token")({
	ssr: false,
	component: ShareDiagramPage,
});

function ShareDiagramPage() {
	const { token } = Route.useParams();
	const diagram = useQuery(api.sharing.getPublicDiagram, {
		shareToken: token,
	});

	if (diagram === undefined) {
		return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
	}
	if (diagram === null) {
		return (
			<div className="grid min-h-screen place-items-center p-6 text-center">
				<div>
					<h1 className="text-lg font-semibold">Diagram not available</h1>
					<p className="text-sm text-neutral-500">
						This link is invalid or sharing was turned off.
					</p>
				</div>
			</div>
		);
	}
	return (
		<div className="min-h-screen bg-neutral-50 text-neutral-900">
			<div className="mx-auto max-w-5xl p-6">
				<p className="rm-label">Shared diagram</p>
				<h1 className="mb-4 text-2xl font-semibold">{diagram.title}</h1>
				<div className="h-[calc(100dvh-160px)] min-h-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
					<DiagramPreview type={diagram.type} source={diagram.source} />
				</div>
			</div>
		</div>
	);
}

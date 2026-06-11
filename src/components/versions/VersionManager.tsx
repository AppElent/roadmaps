import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { VersionDialog } from "./VersionDialog";

export function VersionManager({
	roadmapId,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const versions = useQuery(
		api.roadmapVersions.list,
		open ? { roadmapId } : "skip",
	);
	const createVersion = useMutation(api.roadmapVersions.create);
	const restoreVersion = useMutation(api.roadmapVersions.restore);

	return (
		<VersionDialog
			open={open}
			onOpenChange={onOpenChange}
			entityNoun="roadmap"
			versions={versions}
			onCreate={async (label) => {
				await createVersion({ roadmapId, label });
			}}
			onRestore={async (versionId) => {
				await restoreVersion({
					versionId: versionId as Id<"roadmapVersions">,
				});
			}}
		/>
	);
}

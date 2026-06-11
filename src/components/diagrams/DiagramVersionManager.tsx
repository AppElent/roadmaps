import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { VersionDialog } from "@/components/versions/VersionDialog";

export function DiagramVersionManager({
	diagramId,
	open,
	onOpenChange,
}: {
	diagramId: Id<"diagrams">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const versions = useQuery(
		api.diagramVersions.list,
		open ? { diagramId } : "skip",
	);
	const createVersion = useMutation(api.diagramVersions.create);
	const restoreVersion = useMutation(api.diagramVersions.restore);

	return (
		<VersionDialog
			open={open}
			onOpenChange={onOpenChange}
			entityNoun="diagram"
			versions={versions}
			onCreate={async (label) => {
				await createVersion({ diagramId, label });
			}}
			onRestore={async (versionId) => {
				await restoreVersion({
					versionId: versionId as Id<"diagramVersions">,
				});
			}}
		/>
	);
}

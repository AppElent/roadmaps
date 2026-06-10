import { Plus } from "lucide-react";
import { useState } from "react";

export function AddLaneRow({
	labelWidth,
	onAdd,
}: {
	labelWidth: number;
	onAdd: (name: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState("");

	function commit() {
		const trimmed = name.trim();
		if (trimmed) onAdd(trimmed);
		setName("");
		setEditing(false);
	}

	return (
		<div className="flex border-b border-neutral-200">
			<div
				style={{ width: labelWidth }}
				className="shrink-0 border-r border-neutral-200 bg-white p-2"
			>
				{editing ? (
					<input
						// biome-ignore lint/a11y/noAutofocus: focus the field the user just opened
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === "Enter") commit();
							if (e.key === "Escape") {
								setName("");
								setEditing(false);
							}
						}}
						placeholder="Lane name"
						className="w-full rounded border border-neutral-200 px-1.5 py-1 text-[13px]"
					/>
				) : (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="flex items-center gap-1 text-[13px] text-neutral-500 hover:text-neutral-900"
					>
						<Plus size={14} /> Add lane
					</button>
				)}
			</div>
		</div>
	);
}

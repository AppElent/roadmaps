import { useForm } from "@tanstack/react-form";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { z } from "zod";
import {
	DIAGRAM_ENGINES,
	DIAGRAM_TYPES,
	type DiagramType,
} from "@/lib/diagramEngines";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
});

export interface CreateDiagramDialogProps {
	onCreate: (input: {
		title: string;
		type: DiagramType;
		source: string;
	}) => Promise<void>;
}

export function CreateDiagramDialog({ onCreate }: CreateDiagramDialogProps) {
	const [open, setOpen] = useState(false);
	const [type, setType] = useState<DiagramType>("mermaid");
	const form = useForm({
		defaultValues: { title: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			await onCreate({
				title: value.title,
				type,
				source: DIAGRAM_ENGINES[type].starterSource,
			});
			setOpen(false);
			form.reset();
		},
	});

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="rm-btn-primary">New diagram</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						New diagram
					</Dialog.Title>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="mt-4 flex flex-col gap-3"
					>
						<form.Field name="title">
							{(field) => (
								<label className="flex flex-col gap-1 text-sm">
									Title
									<input
										className="rounded-md border border-neutral-200 px-2 py-2"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors[0] ? (
										<span className="text-xs text-red-600">
											{String(
												field.state.meta.errors[0]?.message ??
													field.state.meta.errors[0],
											)}
										</span>
									) : null}
								</label>
							)}
						</form.Field>
						<label className="flex flex-col gap-1 text-sm">
							Type
							<select
								className="rounded-md border border-neutral-200 px-2 py-2"
								value={type}
								onChange={(e) => setType(e.target.value as DiagramType)}
							>
								{DIAGRAM_TYPES.map((t) => (
									<option key={t} value={t}>
										{DIAGRAM_ENGINES[t].label}
									</option>
								))}
							</select>
						</label>
						<button type="submit" className="mt-2 rm-btn-primary">
							Create
						</button>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

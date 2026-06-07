import { useForm } from "@tanstack/react-form";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { z } from "zod";

const schema = z
	.object({
		name: z.string().min(1, "Name is required"),
		startDate: z.string().min(1, "Start is required"),
		endDate: z.string().min(1, "End is required"),
	})
	.refine((v) => new Date(v.endDate) > new Date(v.startDate), {
		message: "End must be after start",
		path: ["endDate"],
	});

export interface CreateRoadmapDialogProps {
	onCreate: (input: {
		name: string;
		startDate: number;
		endDate: number;
	}) => Promise<void>;
}

export function CreateRoadmapDialog({ onCreate }: CreateRoadmapDialogProps) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { name: "", startDate: "", endDate: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			await onCreate({
				name: value.name,
				startDate: new Date(value.startDate).getTime(),
				endDate: new Date(value.endDate).getTime(),
			});
			setOpen(false);
			form.reset();
		},
	});

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="rm-btn-primary">New roadmap</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						New roadmap
					</Dialog.Title>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="mt-4 flex flex-col gap-3"
					>
						<form.Field name="name">
							{(field) => (
								<label className="flex flex-col gap-1 text-sm">
									Name
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
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="startDate">
								{(field) => (
									<label className="flex flex-col gap-1 text-sm">
										Start
										<input
											type="date"
											className="rounded-md border border-neutral-200 px-2 py-2"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</label>
								)}
							</form.Field>
							<form.Field name="endDate">
								{(field) => (
									<label className="flex flex-col gap-1 text-sm">
										End
										<input
											type="date"
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
						</div>
						<button type="submit" className="mt-2 rm-btn-primary">
							Create
						</button>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

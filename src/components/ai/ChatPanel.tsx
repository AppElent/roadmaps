import { useAuth } from "@clerk/clerk-react";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { BookOpen, PencilLine, Send, Sparkles, Square, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { DocRef } from "@/lib/ai/tools";
import { cn } from "@/lib/utils";

/**
 * Tool-call lifecycle states as streamed by @tanstack/ai-client. "complete"
 * (output available) is the terminal "done" state — NOT "input-complete",
 * which only means the tool's arguments finished streaming, before the
 * server actually executes it. Confirmed against
 * node_modules/@tanstack/ai/dist/esm/activities/chat/stream/message-updaters.js
 * (updateToolCallWithOutput sets state: "complete" once output arrives).
 */
function ToolChip({ name, state }: { name: string; state: string }) {
	const done = state === "complete";
	const failed = state === "error";
	const isWrite = name === "write_document";
	const label = isWrite
		? failed
			? "Failed to update document"
			: done
				? "Updated document (version checkpoint saved)"
				: "Updating document…"
		: failed
			? "Failed to read document"
			: done
				? "Read document"
				: "Reading document…";
	return (
		<span className="my-1 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
			{isWrite ? <PencilLine size={11} /> : <BookOpen size={11} />}
			{label}
		</span>
	);
}

export function ChatPanel({
	docRef,
	onClose,
}: {
	docRef: DocRef;
	onClose?: () => void;
}) {
	const { getToken } = useAuth();
	const [input, setInput] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	const connection = useMemo(
		() =>
			fetchServerSentEvents("/api/chat", async () => ({
				headers: {
					Authorization: `Bearer ${await getToken({ template: "convex" })}`,
				},
				body: { docRef },
			})),
		[getToken, docRef],
	);

	// Scope the ChatClient per document. useChat reads `connection` only once at
	// mount (its client is memoized on a constant clientId), so if this same
	// React instance survives a `docRef` prop change — e.g. Router navigating
	// /roadmaps/A → /roadmaps/B without remounting — the chat would keep talking
	// to the original document. A doc-scoped `id` forces a fresh client (and
	// resets chat history) whenever the document changes.
	const { messages, sendMessage, isLoading, error, stop } = useChat({
		connection,
		id: `${docRef.kind}:${docRef.id}`,
	});

	const submit = () => {
		const text = input.trim();
		if (!text || isLoading) return;
		sendMessage(text);
		setInput("");
		requestAnimationFrame(() =>
			bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 text-sm font-medium">
				<Sparkles size={14} className="text-neutral-500" />
				AI assistant
				{onClose ? (
					<button
						type="button"
						onClick={onClose}
						aria-label="Close AI assistant"
						className="ml-auto rounded-md border border-neutral-200 p-1 text-neutral-500 hover:bg-neutral-100"
					>
						<X size={14} />
					</button>
				) : null}
			</div>

			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
				{messages.length === 0 ? (
					<p className="text-xs text-neutral-400">
						Ask about this document or tell me what to change. Every AI edit
						saves a version checkpoint first.
					</p>
				) : null}
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"text-sm",
							message.role === "user"
								? "ml-6 rounded-lg bg-neutral-100 px-3 py-2"
								: "mr-2",
						)}
					>
						{message.parts.map((part, i) => {
							if (part.type === "text" && part.content) {
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: text parts have no id; the parts array is append-only during a stream, so index is stable
									<p key={`${message.id}-${i}`} className="whitespace-pre-wrap">
										{part.content}
									</p>
								);
							}
							if (part.type === "tool-call") {
								return (
									<div key={part.id}>
										<ToolChip name={part.name} state={part.state} />
									</div>
								);
							}
							return null;
						})}
					</div>
				))}
				{error ? (
					<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
						{error.message}
					</div>
				) : null}
				<div ref={bottomRef} />
			</div>

			<div className="border-t border-neutral-200 p-2">
				<div className="flex items-end gap-2">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submit();
							}
						}}
						disabled={isLoading}
						rows={2}
						placeholder="Ask the assistant…"
						className="min-h-0 flex-1 resize-none rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
					/>
					{isLoading ? (
						<button
							type="button"
							onClick={stop}
							aria-label="Stop"
							className="rounded-md border border-neutral-200 p-2 text-sm hover:bg-neutral-100"
						>
							<Square size={14} />
						</button>
					) : (
						<button
							type="button"
							onClick={submit}
							disabled={!input.trim()}
							aria-label="Send"
							className="rounded-md border border-neutral-200 p-2 text-sm hover:bg-neutral-100 disabled:opacity-40"
						>
							<Send size={14} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

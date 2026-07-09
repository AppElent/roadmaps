// Side-effect import: activates @tanstack/start-client-core's ambient
// `declare module "@tanstack/router-core"` augmentation that adds the
// `server` option to createFileRoute. Nothing else in this codebase uses a
// TanStack Start server route yet, so nothing else pulls this in.
import "@tanstack/react-start";
import { chat, maxIterations, toServerSentEventsResponse } from "@tanstack/ai";
import {
	type AnthropicChatModel,
	createAnthropicChat,
} from "@tanstack/ai-anthropic";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { createDocTools, docRefSchema, readDocument } from "@/lib/ai/tools";
import { buildSystemPrompt, MAX_DOC_CHARS } from "@/lib/aiDoc";
import { msToDateInput } from "@/lib/fields";

const bodySchema = z.object({
	messages: z.array(z.unknown()),
	docRef: docRefSchema,
});

const jsonError = (status: number, message: string) =>
	new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const authHeader = request.headers.get("authorization") ?? "";
				const token = authHeader.replace(/^Bearer\s+/i, "");
				if (!token) return jsonError(401, "Not authenticated");

				const apiKey = process.env.ANTHROPIC_API_KEY;
				if (!apiKey) {
					return jsonError(500, "ANTHROPIC_API_KEY is not configured");
				}

				const parsed = bodySchema.safeParse(await request.json());
				if (!parsed.success) return jsonError(400, "Invalid request body");
				const { messages, docRef } = parsed.data;

				const convex = new ConvexHttpClient(
					import.meta.env.VITE_CONVEX_URL as string,
				);
				convex.setAuth(token);

				// Upfront read: gates auth/ownership before spending model tokens
				// and embeds the current document in the system prompt.
				let docJson: string;
				try {
					docJson = await readDocument(convex, docRef);
				} catch (e) {
					const message = e instanceof Error ? e.message : "Failed to load";
					return jsonError(/authenticat/i.test(message) ? 401 : 404, message);
				}
				if (docJson.length > MAX_DOC_CHARS) {
					return jsonError(413, "This document is too large for AI editing");
				}

				const model = (process.env.ANTHROPIC_MODEL ??
					"claude-sonnet-5") as AnthropicChatModel;
				const today = msToDateInput(Date.now());
				const stream = chat({
					adapter: createAnthropicChat(model, apiKey),
					// messages come from the client as opaque UI-message JSON; @tanstack/ai
					// validates/normalizes their shape at runtime.
					// biome-ignore lint/suspicious/noExplicitAny: see above
					messages: messages as any,
					tools: createDocTools(convex, docRef),
					systemPrompts: [buildSystemPrompt(docRef.kind, docJson, today)],
					agentLoopStrategy: maxIterations(8),
					modelOptions: { max_tokens: 8192 },
				});
				return toServerSentEventsResponse(stream);
			},
		},
	},
});

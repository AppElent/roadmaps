// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useChatMock = vi.fn();

vi.mock("@tanstack/ai-react", () => ({
	useChat: (...args: unknown[]) => useChatMock(...args),
	fetchServerSentEvents: vi.fn(() => ({})),
}));

vi.mock("@clerk/clerk-react", () => ({
	useAuth: () => ({ getToken: vi.fn().mockResolvedValue("jwt") }),
}));

import { ChatPanel } from "@/components/ai/ChatPanel";

const baseChat = {
	messages: [],
	sendMessage: vi.fn(),
	isLoading: false,
	error: undefined,
	stop: vi.fn(),
};

afterEach(cleanup);

describe("ChatPanel", () => {
	it("renders text parts and tool chips", () => {
		useChatMock.mockReturnValue({
			...baseChat,
			messages: [
				{
					id: "m1",
					role: "user",
					parts: [{ type: "text", content: "Add an item" }],
				},
				{
					id: "m2",
					role: "assistant",
					parts: [
						{
							type: "tool-call",
							id: "t1",
							name: "write_document",
							arguments: "{}",
							// Confirmed against @tanstack/ai-client's stream processor
							// (message-updaters.js#updateToolCallWithOutput): the terminal
							// state after a server tool executes is "complete", not
							// "input-complete" (that state only means the arguments have
							// finished streaming, before execution).
							state: "complete",
						},
						{ type: "text", content: "Done — added it." },
					],
				},
			],
		});
		render(<ChatPanel docRef={{ kind: "roadmap", id: "rm1" }} />);
		expect(screen.getByText("Add an item")).toBeDefined();
		expect(screen.getByText("Done — added it.")).toBeDefined();
		expect(screen.getByText(/Updated document/)).toBeDefined();
	});

	it("disables input and shows Stop while streaming", () => {
		useChatMock.mockReturnValue({ ...baseChat, isLoading: true });
		render(<ChatPanel docRef={{ kind: "diagram", id: "dg1" }} />);
		expect(
			(screen.getByPlaceholderText(/ask/i) as HTMLTextAreaElement).disabled,
		).toBe(true);
		expect(screen.getByRole("button", { name: /stop/i })).toBeDefined();
	});

	it("shows errors inline", () => {
		useChatMock.mockReturnValue({
			...baseChat,
			error: new Error("boom"),
		});
		render(<ChatPanel docRef={{ kind: "diagram", id: "dg1" }} />);
		expect(screen.getByText(/boom/)).toBeDefined();
	});
});

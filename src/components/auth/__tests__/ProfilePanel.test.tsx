// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// jsdom here ships without localStorage (opaque origin) or matchMedia; the
// embedded AppearanceSettings touches both on mount, so provide minimal stubs.
beforeAll(() => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => store.set(k, v),
		removeItem: (k: string) => store.delete(k),
		clear: () => store.clear(),
	});
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		onchange: null,
		dispatchEvent: () => false,
	}));
});

const update = vi.fn();
const updatePassword = vi.fn();
const signOut = vi.fn();
// Stable user reference so ProfilePanel's seeding effect (deps: [user]) doesn't
// re-run on every render and clobber typed input.
const user = {
	firstName: "Eric",
	lastName: "Jansen",
	primaryEmailAddress: { emailAddress: "e@x.com" },
	update,
	updatePassword,
};
vi.mock("@clerk/clerk-react", () => ({
	useUser: () => ({ isLoaded: true, isSignedIn: true, user }),
	useClerk: () => ({ signOut }),
}));

import { ProfilePanel } from "../ProfilePanel";

describe("ProfilePanel", () => {
	afterEach(() => {
		cleanup();
		for (const m of [update, updatePassword, signOut]) m.mockReset();
	});

	it("saves name changes", async () => {
		update.mockResolvedValue({});
		render(<ProfilePanel />);
		fireEvent.change(screen.getByLabelText("First name"), {
			target: { value: "Erik" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
		await vi.waitFor(() =>
			expect(update).toHaveBeenCalledWith({
				firstName: "Erik",
				lastName: "Jansen",
			}),
		);
	});

	it("signs out", () => {
		render(<ProfilePanel />);
		fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalled();
	});
});

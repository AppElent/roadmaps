// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const setActive = vi.fn();
let isLoaded = true;
vi.mock("@clerk/clerk-react", () => ({
	useSignIn: () => ({ isLoaded, signIn: { create }, setActive }),
}));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignInForm } from "../SignInForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignInForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("SignInForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		create.mockReset();
		setActive.mockReset();
		isLoaded = true;
	});

	it("does not submit while Clerk is not loaded", () => {
		isLoaded = false;
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(create).not.toHaveBeenCalled();
	});

	it("submits credentials and activates the session", async () => {
		create.mockResolvedValue({ status: "complete", createdSessionId: "s1" });
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		await vi.waitFor(() =>
			expect(setActive).toHaveBeenCalledWith({ session: "s1" }),
		);
		expect(onSuccess).toHaveBeenCalled();
	});

	it("shows a readable error on failure", async () => {
		create.mockRejectedValue({ errors: [{ message: "Invalid." }] });
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText("Invalid.")).toBeDefined();
	});
});

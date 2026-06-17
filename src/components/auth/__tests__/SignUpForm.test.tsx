// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const prepare = vi.fn();
const attempt = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignUp: () => ({
		isLoaded: true,
		signUp: {
			create,
			prepareEmailAddressVerification: prepare,
			attemptEmailAddressVerification: attempt,
			createdSessionId: "s1",
		},
		setActive,
	}),
}));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignUpForm } from "../SignUpForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignUpForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("SignUpForm", () => {
	afterEach(() => {
		cleanup();
		for (const m of [create, prepare, attempt, setActive]) m.mockReset();
	});

	it("moves to the verification step after creating the account", async () => {
		create.mockResolvedValue({});
		prepare.mockResolvedValue({});
		renderForm();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw12345!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create account/i }));
		expect(await screen.findByLabelText(/verification code/i)).toBeDefined();
		expect(prepare).toHaveBeenCalledWith({ strategy: "email_code" });
	});

	it("verifies the code and completes sign-up", async () => {
		create.mockResolvedValue({});
		prepare.mockResolvedValue({});
		attempt.mockResolvedValue({ status: "complete", createdSessionId: "s1" });
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw12345!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create account/i }));
		const code = await screen.findByLabelText(/verification code/i);
		fireEvent.change(code, { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: /verify/i }));
		await vi.waitFor(() =>
			expect(setActive).toHaveBeenCalledWith({ session: "s1" }),
		);
		expect(onSuccess).toHaveBeenCalled();
	});
});

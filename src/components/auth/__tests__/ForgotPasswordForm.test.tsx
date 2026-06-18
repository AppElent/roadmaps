// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const attemptFirstFactor = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignIn: () => ({
		isLoaded: true,
		signIn: { create, attemptFirstFactor },
		setActive,
	}),
}));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { ForgotPasswordForm } from "../ForgotPasswordForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<ForgotPasswordForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("ForgotPasswordForm", () => {
	afterEach(() => {
		cleanup();
		for (const m of [create, attemptFirstFactor, setActive]) m.mockReset();
	});

	it("requests a reset code then sets a new password", async () => {
		create.mockResolvedValue({});
		attemptFirstFactor.mockResolvedValue({
			status: "complete",
			createdSessionId: "s1",
		});
		const onSuccess = vi.fn();
		renderForm(onSuccess);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		await vi.waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				strategy: "reset_password_email_code",
				identifier: "a@b.com",
			}),
		);

		fireEvent.change(await screen.findByLabelText(/code/i), {
			target: { value: "123456" },
		});
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
		await vi.waitFor(() =>
			expect(setActive).toHaveBeenCalledWith({ session: "s1" }),
		);
		expect(onSuccess).toHaveBeenCalled();
	});
});

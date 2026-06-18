// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignIn: () => ({ isLoaded: true, signIn: { create }, setActive }),
}));

import { TestLoginButton } from "../TestLoginButton";

describe("TestLoginButton", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		create.mockReset();
		setActive.mockReset();
	});

	it("renders nothing without a test instance + creds", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_live_x");
		const { container } = render(<TestLoginButton onSuccess={() => {}} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing on a test instance when creds are absent", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
		vi.stubEnv("VITE_TEST_USER_EMAIL", "");
		vi.stubEnv("VITE_TEST_USER_PASSWORD", "");
		const { container } = render(<TestLoginButton onSuccess={() => {}} />);
		expect(container.firstChild).toBeNull();
	});

	it("signs in with env creds when shown and clicked", async () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
		vi.stubEnv("VITE_TEST_USER_EMAIL", "test@test.com");
		vi.stubEnv("VITE_TEST_USER_PASSWORD", "appelent_test");
		create.mockResolvedValue({
			status: "complete",
			createdSessionId: "sess_1",
		});
		const onSuccess = vi.fn();

		render(<TestLoginButton onSuccess={onSuccess} />);
		screen.getByRole("button", { name: /test/i }).click();
		await vi.waitFor(() =>
			expect(setActive).toHaveBeenCalledWith({ session: "sess_1" }),
		);
		expect(create).toHaveBeenCalledWith({
			identifier: "test@test.com",
			password: "appelent_test",
		});
		expect(onSuccess).toHaveBeenCalled();
	});
});

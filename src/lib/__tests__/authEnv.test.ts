import { describe, expect, it } from "vitest";
import { shouldShowTestLogin } from "../authEnv";

describe("shouldShowTestLogin", () => {
	const base = {
		VITE_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
		VITE_TEST_USER_EMAIL: "test@test.com",
		VITE_TEST_USER_PASSWORD: "appelent_test",
	};

	it("is true on a test instance with creds present", () => {
		expect(shouldShowTestLogin(base)).toBe(true);
	});

	it("is false on a live instance even with creds", () => {
		expect(
			shouldShowTestLogin({
				...base,
				VITE_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
			}),
		).toBe(false);
	});

	it("is false when email is missing", () => {
		expect(
			shouldShowTestLogin({ ...base, VITE_TEST_USER_EMAIL: undefined }),
		).toBe(false);
	});

	it("is false when password is empty", () => {
		expect(shouldShowTestLogin({ ...base, VITE_TEST_USER_PASSWORD: "" })).toBe(
			false,
		);
	});

	it("is false when the key is missing", () => {
		expect(
			shouldShowTestLogin({ ...base, VITE_CLERK_PUBLISHABLE_KEY: undefined }),
		).toBe(false);
	});
});

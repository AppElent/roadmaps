// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthButton } from "../AuthButton";
import { AuthError } from "../AuthError";
import { AuthField } from "../AuthField";

describe("auth primitives", () => {
	afterEach(cleanup);

	it("AuthField renders label and shows error text", () => {
		render(
			<AuthField
				label="Email"
				type="email"
				value=""
				onChange={() => {}}
				error="Required"
			/>,
		);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expect(screen.getByText("Required")).toBeDefined();
	});

	it("AuthButton shows loading and disables", () => {
		render(<AuthButton loading>Sign in</AuthButton>);
		const btn = screen.getByRole("button");
		expect(btn.hasAttribute("disabled")).toBe(true);
	});

	it("AuthError renders nothing when message is empty", () => {
		const { container } = render(<AuthError message={null} />);
		expect(container.firstChild).toBeNull();
	});
});

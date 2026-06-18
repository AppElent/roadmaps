import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { shouldShowTestLogin } from "@/lib/authEnv";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { clerkErrorMessage } from "./types";

export function TestLoginButton({ onSuccess }: { onSuccess: () => void }) {
	const { isLoaded, signIn, setActive } = useSignIn();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!shouldShowTestLogin(import.meta.env)) {
		return null;
	}

	async function loginTestUser() {
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			const result = await signIn.create({
				identifier: import.meta.env.VITE_TEST_USER_EMAIL as string,
				password: import.meta.env.VITE_TEST_USER_PASSWORD as string,
			});
			if (result.status === "complete") {
				await setActive({ session: result.createdSessionId });
				onSuccess();
			} else {
				setError("Test user requires additional steps.");
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-2 flex flex-col gap-1">
			<AuthButton
				type="button"
				variant="ghost"
				loading={loading}
				onClick={loginTestUser}
			>
				▶ Dev: log in as test user
			</AuthButton>
			<AuthError message={error} />
		</div>
	);
}

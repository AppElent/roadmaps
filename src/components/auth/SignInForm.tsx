import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { AuthButton } from "./AuthButton";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { TestLoginButton } from "./TestLoginButton";
import { clerkErrorMessage } from "./types";

export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
	const { isLoaded, signIn, setActive } = useSignIn();
	const config = useAuthConfig();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			const result = await signIn.create({ identifier: email, password });
			if (result.status === "complete") {
				await setActive({ session: result.createdSessionId });
				onSuccess();
			} else {
				setError("Additional verification is required.");
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
			<AuthError message={error} />
			<AuthField
				label="Email"
				type="email"
				autoComplete="email"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthField
				label="Password"
				type="password"
				autoComplete="current-password"
				value={password}
				onChange={setPassword}
				required
			/>
			<AuthButton loading={loading}>Sign in</AuthButton>
			<TestLoginButton onSuccess={onSuccess} />
			<div className="mt-1 flex justify-between text-xs text-[var(--auth-muted)]">
				{config.features.forgotPassword ? (
					<a href={config.paths.forgotPassword} className="hover:underline">
						Forgot password?
					</a>
				) : (
					<span />
				)}
				<a href={config.paths.signUp} className="hover:underline">
					Create an account
				</a>
			</div>
		</form>
	);
}

import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { clerkErrorMessage } from "./types";

export function ForgotPasswordForm({ onSuccess }: { onSuccess: () => void }) {
	const { isLoaded, signIn, setActive } = useSignIn();
	const [step, setStep] = useState<"request" | "reset">("request");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function requestCode(e: React.FormEvent) {
		e.preventDefault();
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			await signIn.create({
				strategy: "reset_password_email_code",
				identifier: email,
			});
			setStep("reset");
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function resetPassword(e: React.FormEvent) {
		e.preventDefault();
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			const result = await signIn.attemptFirstFactor({
				strategy: "reset_password_email_code",
				code,
				password,
			});
			if (result.status === "complete") {
				await setActive({ session: result.createdSessionId });
				onSuccess();
			} else {
				setError("Could not reset password.");
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	if (step === "reset") {
		return (
			<form onSubmit={resetPassword} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<AuthField
					label="Code"
					type="text"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthField
					label="New password"
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={setPassword}
					required
				/>
				<AuthButton loading={loading}>Reset password</AuthButton>
			</form>
		);
	}

	return (
		<form onSubmit={requestCode} noValidate className="flex flex-col gap-3">
			<AuthError message={error} />
			<AuthField
				label="Email"
				type="email"
				autoComplete="email"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthButton loading={loading}>Send code</AuthButton>
		</form>
	);
}

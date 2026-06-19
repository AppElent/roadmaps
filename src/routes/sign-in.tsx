import { AuthCard, SignInForm } from "@appelent/auth";
import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/sign-in")({
	ssr: false,
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();

	useEffect(() => {
		if (isSignedIn) {
			navigate({ to: "/dashboard" });
		}
	}, [isSignedIn, navigate]);

	return (
		<AuthCard title="Sign in" subtitle="Welcome back to ArchStudio.">
			<SignInForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}

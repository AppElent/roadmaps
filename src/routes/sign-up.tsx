import { AuthCard, SignUpForm } from "@appelent/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-up")({
	ssr: false,
	component: SignUpPage,
});

function SignUpPage() {
	const navigate = useNavigate();
	return (
		<AuthCard title="Create your account">
			<SignUpForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignUpForm } from "@/components/auth/SignUpForm";

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

import { UserProfile } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AppearanceSettings } from "@/components/account/AppearanceSettings";

export const Route = createFileRoute("/account/")({
	ssr: false,
	component: AccountPage,
});

function AccountPage() {
	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6">
					<p className="rm-label">Account</p>
					<h1 className="text-2xl font-semibold">Your account</h1>
					<p className="mt-1 text-sm text-neutral-500">
						Manage your profile, security, and appearance.
					</p>
				</header>

				<div className="space-y-6">
					<AppearanceSettings />
					<UserProfile routing="hash" />
				</div>
			</div>
		</AppShell>
	);
}

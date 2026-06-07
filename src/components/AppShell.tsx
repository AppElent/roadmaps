import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { BottomTabBar } from "./BottomTabBar";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SignedIn>
				<div className="flex min-h-screen bg-neutral-50 text-neutral-900">
					<Sidebar />
					<main className="min-w-0 flex-1 pb-16 sm:pb-0">{children}</main>
					<BottomTabBar />
				</div>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<main className="grid min-h-screen place-items-center p-6">
			<div className="max-w-md text-center">
				<div className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-neutral-900 font-mono text-sm font-bold">
					AS
				</div>
				<h1 className="mb-2 text-3xl font-semibold tracking-tight">
					ArchStudio
				</h1>
				<p className="mb-6 text-sm text-neutral-500">
					The architect's workbench — roadmaps, diagrams, and more in one place.
				</p>

				<SignedOut>
					<SignInButton mode="modal">
						<button
							type="button"
							className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
						>
							Sign in
						</button>
					</SignInButton>
				</SignedOut>

				<SignedIn>
					<div className="flex items-center justify-center gap-3">
						<Link
							to="/dashboard"
							className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
						>
							Go to dashboard
						</Link>
						<UserButton />
					</div>
				</SignedIn>
			</div>
		</main>
	);
}

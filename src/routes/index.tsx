import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	type LucideIcon,
	Map as MapIcon,
	Sparkles,
	Workflow,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

interface ToolHighlight {
	icon: LucideIcon;
	title: string;
	description: string;
	features: string[];
	status: "live" | "soon";
}

const TOOLS: ToolHighlight[] = [
	{
		icon: MapIcon,
		title: "Roadmaps",
		description: "Plan initiatives on a real-time timeline.",
		features: [
			"Drag & resize across lanes",
			"Custom fields & milestones",
			"Read-only share links",
		],
		status: "live",
	},
	{
		icon: Workflow,
		title: "Diagrams",
		description: "Author Mermaid & PlantUML with a live preview.",
		features: [
			"Instant client-side rendering",
			"Version history",
			"Shareable read-only views",
		],
		status: "live",
	},
	{
		icon: Sparkles,
		title: "AI helper",
		description: "A Claude-powered assistant for your workbench.",
		features: [
			"Draft diagrams from a prompt",
			"Summarize a roadmap",
			"Right inside the editor",
		],
		status: "soon",
	},
];

function PrimaryCta({ children }: { children: string }) {
	return (
		<>
			<SignedOut>
				<SignInButton mode="modal">
					<button
						type="button"
						className="rounded-full bg-[var(--palm)] px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
					>
						{children}
					</button>
				</SignInButton>
			</SignedOut>
			<SignedIn>
				<Link
					to="/dashboard"
					className="rounded-full bg-[var(--palm)] px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
				>
					Go to dashboard
				</Link>
			</SignedIn>
		</>
	);
}

function ToolHighlightCard({
	icon: Icon,
	title,
	description,
	features,
	status,
}: ToolHighlight) {
	return (
		<div
			className={cn(
				"feature-card flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-5",
				status === "soon" && "opacity-70",
			)}
		>
			<div className="flex items-center gap-2">
				<div className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--lagoon-deep)]">
					<Icon size={18} aria-hidden />
				</div>
				<strong className="text-[var(--sea-ink)]">{title}</strong>
				{status === "soon" && (
					<span className="island-kicker ml-auto rounded-full border border-[var(--chip-line)] px-2 py-0.5">
						Soon
					</span>
				)}
			</div>
			<p className="text-sm text-[var(--sea-ink-soft)]">{description}</p>
			<ul className="mt-auto flex flex-col gap-1.5">
				{features.map((feature) => (
					<li
						key={feature}
						className="flex items-center gap-2 text-xs text-[var(--sea-ink-soft)]"
					>
						<span
							className="size-1 rounded-full bg-[var(--lagoon-deep)]"
							aria-hidden
						/>
						{feature}
					</li>
				))}
			</ul>
		</div>
	);
}

function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="page-wrap flex items-center justify-between py-5">
				<div className="flex items-center gap-2">
					<div className="grid size-8 place-items-center rounded-md border border-[var(--line)] font-mono text-xs font-bold text-[var(--sea-ink)]">
						AS
					</div>
					<strong className="text-[var(--sea-ink)]">ArchStudio</strong>
				</div>
				<div className="flex items-center gap-3">
					<ThemeToggle />
					<SignedOut>
						<SignInButton mode="modal">
							<button
								type="button"
								className="rounded-full bg-[var(--palm)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
							>
								Sign in
							</button>
						</SignInButton>
					</SignedOut>
					<SignedIn>
						<Link
							to="/dashboard"
							className="rounded-full bg-[var(--palm)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
						>
							Open app
						</Link>
						<UserButton />
					</SignedIn>
				</div>
			</header>

			<main className="page-wrap flex flex-1 flex-col">
				<section className="rise-in relative isolate flex flex-col items-center py-20 text-center">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 -z-10"
						style={{
							backgroundImage:
								"linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
							backgroundSize: "32px 32px",
							maskImage:
								"radial-gradient(circle at 50% 38%, black, transparent 70%)",
							WebkitMaskImage:
								"radial-gradient(circle at 50% 38%, black, transparent 70%)",
							opacity: 0.55,
						}}
					/>
					<p className="island-kicker mb-4">The architect's workbench</p>
					<h1 className="display-title mb-4 max-w-2xl text-4xl font-medium tracking-tight text-[var(--sea-ink)] sm:text-5xl">
						The drafting table for software architects.
					</h1>
					<p className="mb-8 max-w-xl text-base text-[var(--sea-ink-soft)]">
						Roadmaps, diagrams, and more in one place — a calm home for the
						plans and pictures that shape what you're building.
					</p>
					<PrimaryCta>Start planning</PrimaryCta>
				</section>

				<section className="grid gap-4 pb-16 sm:grid-cols-3">
					{TOOLS.map((tool) => (
						<ToolHighlightCard key={tool.title} {...tool} />
					))}
				</section>
			</main>

			<footer className="site-footer">
				<div className="page-wrap flex flex-col items-center justify-between gap-2 py-6 text-xs text-[var(--sea-ink-soft)] sm:flex-row">
					<span className="font-mono">ArchStudio</span>
					<span>Built with TanStack Start · Convex · Clerk · Cloudflare</span>
				</div>
			</footer>
		</div>
	);
}

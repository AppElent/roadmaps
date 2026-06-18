# Porting the `auth/` module into another app

> **For the AI agent reading this:** This folder is a portable, de-branded Clerk
> auth UI (custom sign-in / sign-up / forgot-password / profile, a dev-only
> test-login button, optional theme sync to Clerk). The user copied this
> `auth/` folder into a TanStack React Start + Clerk app and wants you to wire
> it in. Follow the steps below **in order**. Create any file whose content is
> given here if it doesn't already exist; adapt, don't blindly overwrite,
> existing files. Work on a feature branch, commit in small steps, and run the
> verification at the end. Don't invent file paths — match this app's structure.

## What's already in this folder (do NOT recreate)

`AuthConfigProvider.tsx` (`AuthConfigProvider`, `useAuthConfig`, `DEFAULT_AUTH_CONFIG`),
`types.ts` (`AuthConfig`, `SlotClassNames`, `SocialProvider`, `clerkErrorMessage`),
`AuthField.tsx`, `AuthButton.tsx`, `AuthError.tsx`, `AuthCard.tsx`,
`TestLoginButton.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `ForgotPasswordForm.tsx`,
`ProfilePanel.tsx`. These reference each other with relative imports and need no changes.

## Design contract (so you wire it correctly)

- Components are **headless-ish**: default styling comes from `--auth-*` CSS
  variables; every part also accepts a `classNames` slot map merged via `cn()`.
- Forms are **framework-agnostic**: they take an `onSuccess: () => void` prop and
  cross-link with plain `<a href>` from `useAuthConfig().paths`. They do NOT import
  the router. The **route files** own navigation.
- The test-login button only renders when the Clerk key is `pk_test_*` AND
  `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set. Credentials come from
  env, never hardcoded, and never ship to production.

## Prerequisites (verify, install if missing)

- `@clerk/clerk-react` (v5+), `@tanstack/react-router`, Tailwind CSS v4.
- `clsx` + `tailwind-merge`, exposed as `cn()` in `src/lib/utils.ts`:
  ```ts
  import { type ClassValue, clsx } from "clsx";
  import { twMerge } from "tailwind-merge";
  export function cn(...inputs: ClassValue[]) {
  	return twMerge(clsx(inputs));
  }
  ```
- Path alias `@/*` → `src/*` (used throughout). If this app uses a different alias,
  update the imports in this folder to match.

---

## Step 1 — Create `src/lib/authEnv.ts`

```ts
export interface TestLoginEnv {
	VITE_CLERK_PUBLISHABLE_KEY?: string;
	VITE_TEST_USER_EMAIL?: string;
	VITE_TEST_USER_PASSWORD?: string;
}

/**
 * Show the dev test-login button only on a Clerk *test* instance with the
 * test-user credentials provided via env. Both conditions must hold, so the
 * button can never appear in production (pk_live_ + no creds in the bundle).
 */
export function shouldShowTestLogin(env: TestLoginEnv): boolean {
	const onTestInstance = !!env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");
	const hasCreds = !!env.VITE_TEST_USER_EMAIL && !!env.VITE_TEST_USER_PASSWORD;
	return onTestInstance && hasCreds;
}
```

## Step 2 — Type the env vars (`src/vite-env.d.ts`)

If this file exists, just merge the extra keys into its `ImportMetaEnv` interface.

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CLERK_PUBLISHABLE_KEY: string;
	readonly VITE_CONVEX_URL: string;
	/** Dev-only test-login credentials; present only on non-prod (test) builds. */
	readonly VITE_TEST_USER_EMAIL?: string;
	readonly VITE_TEST_USER_PASSWORD?: string;
}
```

## Step 3 — Add the `--auth-*` design tokens

Add these to the app's global stylesheet (e.g. `src/styles.css`). Put the first
block under the light theme selector and the second under the dark one. **Re-point
the values at this app's palette** (the `var(--rm-accent)` references below are the
source app's brand tokens — replace with this app's).

```css
/* light */
--auth-bg: oklch(98% 0.004 240);
--auth-fg: oklch(25% 0.02 240);
--auth-muted: oklch(50% 0.018 240);
--auth-card-bg: oklch(100% 0 0);
--auth-border: oklch(90% 0.008 240);
--auth-radius: 0.625rem;
--auth-field-bg: oklch(100% 0 0);
--auth-accent: var(--your-brand-accent);
--auth-accent-fg: var(--your-brand-accent-fg);
--auth-error: oklch(58% 0.18 25);
```

```css
/* dark */
--auth-bg: oklch(16% 0.012 250);
--auth-fg: oklch(92% 0.01 240);
--auth-muted: oklch(70% 0.02 240);
--auth-card-bg: oklch(20% 0.012 250);
--auth-border: oklch(30% 0.01 240);
--auth-radius: 0.625rem;
--auth-field-bg: oklch(24% 0.012 250);
--auth-accent: var(--your-brand-accent);
--auth-accent-fg: var(--your-brand-accent-fg);
--auth-error: oklch(70% 0.15 25);
```

## Step 4 — Custom HeaderUser (`src/integrations/clerk/header-user.tsx`)

Replaces Clerk's `<UserButton>`/`<SignInButton>`. Uses literal route paths because
TanStack Router types `to` strictly — keep them as literals matching this app's routes.

```tsx
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function HeaderUser() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const [open, setOpen] = useState(false);
	const initials =
		(user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?").toUpperCase();

	return (
		<>
			<SignedIn>
				<div className="relative">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--auth-accent)] text-sm font-medium text-[var(--auth-accent-fg)]"
						aria-label="Account menu"
					>
						{initials}
					</button>
					{open ? (
						<div className={cn("absolute right-0 mt-2 w-40 rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-1 shadow-md")}>
							<Link
								to="/account"
								onClick={() => setOpen(false)}
								className="block rounded px-3 py-2 text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								Account
							</Link>
							<button
								type="button"
								onClick={() => signOut()}
								className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								Sign out
							</button>
						</div>
					) : null}
				</div>
			</SignedIn>
			<SignedOut>
				<Link to="/sign-in" className="text-sm font-medium text-[var(--auth-fg)] hover:underline">
					Sign in
				</Link>
			</SignedOut>
		</>
	);
}
```

## Step 5 — Routes (`src/routes/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`)

Adjust `ssr`/route-creation to this app's router conventions, and change the
post-login target (`/dashboard` below) to this app's home route.

```tsx
// src/routes/sign-in.tsx
import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";

export const Route = createFileRoute("/sign-in")({ ssr: false, component: SignInPage });

function SignInPage() {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	useEffect(() => {
		if (isSignedIn) navigate({ to: "/dashboard" });
	}, [isSignedIn, navigate]);
	return (
		<AuthCard title="Sign in">
			<SignInForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
```

```tsx
// src/routes/sign-up.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const Route = createFileRoute("/sign-up")({ ssr: false, component: SignUpPage });

function SignUpPage() {
	const navigate = useNavigate();
	return (
		<AuthCard title="Create your account">
			<SignUpForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
```

```tsx
// src/routes/forgot-password.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const Route = createFileRoute("/forgot-password")({ ssr: false, component: ForgotPasswordPage });

function ForgotPasswordPage() {
	const navigate = useNavigate();
	return (
		<AuthCard title="Reset your password">
			<ForgotPasswordForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
```

After creating routes, regenerate the route tree (`npx tsr generate` or via the dev server) and commit the regenerated `routeTree.gen.ts`.

## Step 6 — Point Clerk redirects at the custom routes

In this app's `<ClerkProvider>` (wherever it's configured), add:

```tsx
<ClerkProvider publishableKey={...} afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up">
```

## Step 7 — Replace remaining Clerk-branded UI

Grep for `UserButton`, `UserProfile`, `SignInButton`, `SignUpButton` across `src`.
Replace each: `<UserButton/>` → `<HeaderUser />`; `<SignInButton>` → `<Link to="/sign-in">`;
`<UserProfile/>` → render `<ProfilePanel />` on the `/account` route. `RedirectToSignIn`
can stay — it now redirects to `/sign-in` via the `signInUrl` set in Step 6.

## Step 8 — `/account` route

Render `ProfilePanel` inside this app's authed shell:

```tsx
import { ProfilePanel } from "@/components/auth/ProfilePanel";
// ...inside the authed /account route component:
<ProfilePanel />
```

> **Coupling note:** `ProfilePanel.tsx` imports `@/components/account/AppearanceSettings`
> (a light/dark control tied to theme sync). If this app has no such component,
> EITHER do the optional theme-sync setup (Step 9) and provide `AppearanceSettings`,
> OR remove the `AppearanceSettings` import and its one `<AppearanceSettings />` usage
> from `ProfilePanel.tsx`.

## Step 9 — (Optional) Theme sync to Clerk `unsafeMetadata`

Skip this entirely if you don't want cross-device theme sync (and remove the
`AppearanceSettings` usage from `ProfilePanel` per Step 8). To enable it, this app
needs a `src/lib/theme.ts` with the API below. If the app already has theme handling,
add `reconcileTheme` to it; otherwise create the whole file:

```ts
export type ThemeMode = "light" | "dark" | "auto";

export function getInitialMode(): ThemeMode {
	if (typeof window === "undefined") return "auto";
	const stored = window.localStorage.getItem("theme");
	return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
}

export function applyThemeMode(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);
	if (mode === "auto") document.documentElement.removeAttribute("data-theme");
	else document.documentElement.setAttribute("data-theme", mode);
	document.documentElement.style.colorScheme = resolved;
}

export function setThemeMode(mode: ThemeMode) {
	applyThemeMode(mode);
	window.localStorage.setItem("theme", mode);
}

function isThemeMode(value: unknown): value is ThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

/** Clerk-stored theme vs local mode → mode to apply, or null if no change. Pure. */
export function reconcileTheme(clerkTheme: unknown, localTheme: ThemeMode): ThemeMode | null {
	if (!isThemeMode(clerkTheme)) return null;
	return clerkTheme === localTheme ? null : clerkTheme;
}
```

Then create `src/components/ThemeSync.tsx` and mount `<ThemeSync />` once at the root,
inside the Clerk provider:

```tsx
import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { applyThemeMode, getInitialMode, reconcileTheme, setThemeMode } from "@/lib/theme";

/** On sign-in, reconcile Clerk-stored theme with localStorage. Renders nothing. */
export function ThemeSync() {
	const { isLoaded, isSignedIn, user } = useUser();
	useEffect(() => {
		if (!isLoaded || !isSignedIn || !user) return;
		const next = reconcileTheme(user.unsafeMetadata?.theme, getInitialMode());
		if (next) setThemeMode(next);
		else applyThemeMode(getInitialMode());
	}, [isLoaded, isSignedIn, user]);
	return null;
}
```

For FOUC-free first paint, add a pre-paint script in the document `<head>` that reads
`localStorage.theme` and sets the `.light`/`.dark` class before React hydrates. To
**write** theme to Clerk on change, in your appearance control call:
`user?.update({ unsafeMetadata: { ...user.unsafeMetadata, theme: next } }).catch(() => {})`
alongside `setThemeMode(next)`.

## Step 10 — Env + Clerk test user

- Add to `.env.local` (gitignored — never commit values):
  ```
  VITE_TEST_USER_EMAIL=test@test.com
  VITE_TEST_USER_PASSWORD=<the test user's password>
  ```
- Document the keys (no values) in `.env.example`.
- Create that user on the Clerk **test** instance so the dev test-login button works.
- **Never** put the password in committed files (wrangler config, etc.). `VITE_*` vars
  are build-time inlined, so they only need to be in the build environment.

---

## Per-app customization (no edits to this folder)

- **Colors / spacing / radius** → override the `--auth-*` CSS variables.
- **Branding, logo, links, post-auth path** → wrap the auth routes in
  `<AuthConfigProvider config={{ appName, logo, paths, features, socialProviders }}>`.
- **Structural restyle of any part** → pass `classNames={{ root, input, label, button, error }}`.
- **Social providers** (future) → set `AuthConfig.socialProviders`; the forms render a
  provider row when it's non-empty. The redirect flow + `/sso-callback` route are not
  built — add them when needed.

## Verification (must pass before done)

```bash
npx tsc --noEmit          # types
npx vitest run src/components/auth   # the module's own tests (if you copied __tests__)
<lint command>            # e.g. npx biome check  (or eslint) — match this app
<build command>           # e.g. npm run build — smoke test
```

Then manually: visit `/sign-in` (custom card renders), `/sign-up` (2-step verify),
`/forgot-password` (2-step reset), `/account` (ProfilePanel), and confirm no Clerk-branded
`UserButton`/`SignInButton`/`UserProfile` remain.

# Custom Clerk Auth Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ArchStudio's Clerk-branded auth UI with fully custom, themeable, copy-portable components (sign-in, sign-up + verification, forgot-password, profile), a dev-only test-login button, and theme sync to Clerk `unsafeMetadata`.

**Architecture:** A self-contained `src/components/auth/` module built on Clerk React hooks (`useSignIn`, `useSignUp`, `useUser`, `useClerk`). Components carry default styling via `--auth-*` CSS-variable tokens and accept per-slot `classNames` overrides (merged with `cn()`); they take an `onSuccess` callback instead of importing the router, so they stay portable and trivially testable. Dedicated routes (`/sign-in`, `/sign-up`, `/forgot-password`) wrap the forms and own navigation. Theme is mirrored to Clerk `unsafeMetadata` while localStorage stays the pre-paint source.

**Tech Stack:** React 19, TanStack React Start/Router, `@clerk/clerk-react@5.61`, Tailwind v4, Biome, Vitest (+ jsdom for components), `cn()` from `src/lib/utils.ts`.

**Reference spec:** `docs/superpowers/specs/2026-06-17-custom-clerk-auth-components-design.md`

---

## Conventions for every task

- **Biome:** tabs, double quotes. Run `npx biome check --write src/` before each commit.
- **Type check:** `npx tsc --noEmit` must pass.
- **Component tests** start with `// @vitest-environment jsdom` and use `@testing-library/react` with `afterEach(cleanup)` (see `src/components/__tests__/ToolCard.test.tsx`).
- **Pure-logic tests** live in `src/lib/__tests__/` (node env, no docblock).
- Run a single test file with: `npx vitest run <path>`.
- Commit messages: conventional commits, end with the `Co-Authored-By` trailer the repo uses.

---

## File Structure

**New — pure logic + tests**
- `src/lib/authEnv.ts` — `shouldShowTestLogin(env)`.
- `src/lib/__tests__/authEnv.test.ts`.
- `src/lib/theme.ts` — add `reconcileTheme()` (pure) + `setThemeMode` unchanged signature.
- `src/lib/__tests__/theme.test.ts`.

**New — auth module**
- `src/components/auth/types.ts` — `AuthConfig`, `SlotClassNames`, `SocialProvider`, `clerkErrorMessage()`.
- `src/components/auth/AuthConfigProvider.tsx` — context + `useAuthConfig()` + `DEFAULT_AUTH_CONFIG`.
- `src/components/auth/AuthField.tsx`, `AuthButton.tsx`, `AuthError.tsx` — primitives.
- `src/components/auth/AuthCard.tsx` — centered-card shell.
- `src/components/auth/TestLoginButton.tsx`.
- `src/components/auth/SignInForm.tsx`.
- `src/components/auth/SignUpForm.tsx` (+ inline verify step).
- `src/components/auth/ForgotPasswordForm.tsx`.
- `src/components/auth/ProfilePanel.tsx`.
- `src/components/auth/HeaderUser.tsx`.
- Tests under `src/components/auth/__tests__/`.

**New — wiring**
- `src/components/ThemeSync.tsx`.
- `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`.

**Modified**
- `src/styles.css` — `--auth-*` tokens (light + dark).
- `src/integrations/clerk/provider.tsx` — `signInUrl` / `signUpUrl`.
- `src/integrations/clerk/header-user.tsx` — use the new `HeaderUser`.
- `src/routes/__root.tsx` — mount `<ThemeSync />`.
- `src/routes/account/index.tsx` — `ProfilePanel` instead of `<UserProfile>`.
- `src/components/account/AppearanceSettings.tsx` — write theme to Clerk on change.
- `.env.example`, `wrangler.jsonc`.

---

## Task 1: `--auth-*` design tokens

**Files:**
- Modify: `src/styles.css` (light tokens near line 65, dark near line 129)

- [ ] **Step 1: Add light-mode tokens**

In the `:root`/light token block (around line 65, alongside `--rm-accent`), add:

```css
  --auth-bg: oklch(98% 0.004 240);
  --auth-fg: oklch(25% 0.02 240);
  --auth-muted: oklch(50% 0.018 240);
  --auth-card-bg: oklch(100% 0 0);
  --auth-border: oklch(90% 0.008 240);
  --auth-radius: 0.625rem;
  --auth-field-bg: oklch(100% 0 0);
  --auth-accent: var(--rm-accent);
  --auth-accent-fg: var(--rm-accent-fg);
  --auth-error: oklch(58% 0.18 25);
```

- [ ] **Step 2: Add dark-mode tokens**

In the dark token block (around line 129), add:

```css
  --auth-bg: oklch(16% 0.012 250);
  --auth-fg: oklch(92% 0.01 240);
  --auth-muted: oklch(70% 0.02 240);
  --auth-card-bg: oklch(20% 0.012 250);
  --auth-border: oklch(30% 0.01 240);
  --auth-radius: 0.625rem;
  --auth-field-bg: oklch(24% 0.012 250);
  --auth-accent: var(--rm-accent);
  --auth-accent-fg: var(--rm-accent-fg);
  --auth-error: oklch(70% 0.15 25);
```

- [ ] **Step 3: Verify the build still compiles CSS**

Run: `npx biome check src/styles.css` (styles.css is lint-excluded, so this is a no-op pass) and `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat(auth): add --auth-* design tokens (light + dark)"
```

---

## Task 2: `shouldShowTestLogin` env helper (TDD)

**Files:**
- Create: `src/lib/authEnv.ts`
- Test: `src/lib/__tests__/authEnv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { shouldShowTestLogin } from "../authEnv";

describe("shouldShowTestLogin", () => {
	const base = {
		VITE_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
		VITE_TEST_USER_EMAIL: "test@test.com",
		VITE_TEST_USER_PASSWORD: "appelent_test",
	};

	it("is true on a test instance with creds present", () => {
		expect(shouldShowTestLogin(base)).toBe(true);
	});

	it("is false on a live instance even with creds", () => {
		expect(
			shouldShowTestLogin({ ...base, VITE_CLERK_PUBLISHABLE_KEY: "pk_live_abc" }),
		).toBe(false);
	});

	it("is false when email is missing", () => {
		expect(shouldShowTestLogin({ ...base, VITE_TEST_USER_EMAIL: undefined })).toBe(
			false,
		);
	});

	it("is false when password is empty", () => {
		expect(shouldShowTestLogin({ ...base, VITE_TEST_USER_PASSWORD: "" })).toBe(false);
	});

	it("is false when the key is missing", () => {
		expect(
			shouldShowTestLogin({ ...base, VITE_CLERK_PUBLISHABLE_KEY: undefined }),
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/authEnv.test.ts`
Expected: FAIL — cannot find module `../authEnv`.

- [ ] **Step 3: Write minimal implementation**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/authEnv.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/lib/authEnv.ts src/lib/__tests__/authEnv.test.ts
git add src/lib/authEnv.ts src/lib/__tests__/authEnv.test.ts
git commit -m "feat(auth): add shouldShowTestLogin env helper"
```

---

## Task 3: Theme reconcile logic (TDD)

**Files:**
- Modify: `src/lib/theme.ts`
- Test: `src/lib/__tests__/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { reconcileTheme } from "../theme";

describe("reconcileTheme", () => {
	it("returns the Clerk value when it is a valid mode and differs from local", () => {
		expect(reconcileTheme("dark", "light")).toBe("dark");
	});

	it("returns null when Clerk and local already agree", () => {
		expect(reconcileTheme("dark", "dark")).toBeNull();
	});

	it("returns null when Clerk has no stored theme", () => {
		expect(reconcileTheme(undefined, "light")).toBeNull();
	});

	it("returns null when the Clerk value is not a valid mode", () => {
		expect(reconcileTheme("neon", "light")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: FAIL — `reconcileTheme` is not exported.

- [ ] **Step 3: Add the pure reconcile function to `theme.ts`**

Append to `src/lib/theme.ts`:

```ts
function isThemeMode(value: unknown): value is ThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

/**
 * Given the theme stored in Clerk metadata and the current local mode, return
 * the mode to apply, or null if nothing should change. Pure — no DOM/storage.
 */
export function reconcileTheme(
	clerkTheme: unknown,
	localTheme: ThemeMode,
): ThemeMode | null {
	if (!isThemeMode(clerkTheme)) {
		return null;
	}
	return clerkTheme === localTheme ? null : clerkTheme;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/lib/theme.ts src/lib/__tests__/theme.test.ts
git add src/lib/theme.ts src/lib/__tests__/theme.test.ts
git commit -m "feat(auth): add reconcileTheme pure helper for Clerk theme sync"
```

---

## Task 4: Auth types + config provider

**Files:**
- Create: `src/components/auth/types.ts`
- Create: `src/components/auth/AuthConfigProvider.tsx`

- [ ] **Step 1: Write `types.ts`**

```ts
export type SlotClassNames<Slot extends string> = Partial<Record<Slot, string>>;

export interface SocialProvider {
	id: string; // e.g. "google"
	label: string;
	strategy: `oauth_${string}`;
}

export interface AuthConfig {
	appName: string;
	logo?: React.ReactNode;
	paths: {
		signIn: string;
		signUp: string;
		forgotPassword: string;
		afterAuth: string;
		account: string;
	};
	features: { forgotPassword: boolean };
	socialProviders: SocialProvider[];
}

interface ClerkLikeError {
	errors?: { longMessage?: string; message?: string }[];
}

/** Extract a readable message from a thrown Clerk error (or any error). */
export function clerkErrorMessage(err: unknown, fallback = "Something went wrong."): string {
	const e = err as ClerkLikeError;
	const first = e?.errors?.[0];
	return first?.longMessage ?? first?.message ?? fallback;
}
```

- [ ] **Step 2: Write `AuthConfigProvider.tsx`**

```tsx
import { createContext, useContext } from "react";
import type { AuthConfig } from "./types";

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
	appName: "ArchStudio",
	paths: {
		signIn: "/sign-in",
		signUp: "/sign-up",
		forgotPassword: "/forgot-password",
		afterAuth: "/dashboard",
		account: "/account",
	},
	features: { forgotPassword: true },
	socialProviders: [],
};

const AuthConfigContext = createContext<AuthConfig>(DEFAULT_AUTH_CONFIG);

export function AuthConfigProvider({
	config = DEFAULT_AUTH_CONFIG,
	children,
}: {
	config?: AuthConfig;
	children: React.ReactNode;
}) {
	return (
		<AuthConfigContext.Provider value={config}>{children}</AuthConfigContext.Provider>
	);
}

export function useAuthConfig(): AuthConfig {
	return useContext(AuthConfigContext);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
npx biome check --write src/components/auth/
git add src/components/auth/types.ts src/components/auth/AuthConfigProvider.tsx
git commit -m "feat(auth): add AuthConfig types and config provider"
```

---

## Task 5: Primitives — AuthField, AuthButton, AuthError (TDD)

**Files:**
- Create: `src/components/auth/AuthField.tsx`, `AuthButton.tsx`, `AuthError.tsx`
- Test: `src/components/auth/__tests__/primitives.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthButton } from "../AuthButton";
import { AuthError } from "../AuthError";
import { AuthField } from "../AuthField";

describe("auth primitives", () => {
	afterEach(cleanup);

	it("AuthField renders label and shows error text", () => {
		render(
			<AuthField
				label="Email"
				type="email"
				value=""
				onChange={() => {}}
				error="Required"
			/>,
		);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expect(screen.getByText("Required")).toBeDefined();
	});

	it("AuthButton shows loading and disables", () => {
		render(<AuthButton loading>Sign in</AuthButton>);
		const btn = screen.getByRole("button");
		expect(btn.hasAttribute("disabled")).toBe(true);
	});

	it("AuthError renders nothing when message is empty", () => {
		const { container } = render(<AuthError message={null} />);
		expect(container.firstChild).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/primitives.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `AuthField.tsx`**

```tsx
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { SlotClassNames } from "./types";

export function AuthField({
	label,
	type,
	value,
	onChange,
	error,
	autoComplete,
	required,
	classNames,
}: {
	label: string;
	type: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	autoComplete?: string;
	required?: boolean;
	classNames?: SlotClassNames<"root" | "label" | "input" | "error">;
}) {
	const id = useId();
	return (
		<div className={cn("flex flex-col gap-1", classNames?.root)}>
			<label
				htmlFor={id}
				className={cn(
					"text-sm font-medium text-[var(--auth-fg)]",
					classNames?.label,
				)}
			>
				{label}
			</label>
			<input
				id={id}
				type={type}
				value={value}
				required={required}
				autoComplete={autoComplete}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					"rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-field-bg)] px-3 py-2 text-sm text-[var(--auth-fg)] outline-none focus:border-[var(--auth-accent)]",
					classNames?.input,
				)}
			/>
			{error ? (
				<p className={cn("text-xs text-[var(--auth-error)]", classNames?.error)}>
					{error}
				</p>
			) : null}
		</div>
	);
}
```

- [ ] **Step 4: Implement `AuthButton.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function AuthButton({
	children,
	loading,
	variant = "primary",
	type = "submit",
	onClick,
	className,
}: {
	children: React.ReactNode;
	loading?: boolean;
	variant?: "primary" | "ghost";
	type?: "submit" | "button";
	onClick?: () => void;
	className?: string;
}) {
	return (
		<button
			type={type}
			disabled={loading}
			onClick={onClick}
			className={cn(
				"inline-flex items-center justify-center rounded-[var(--auth-radius)] px-4 py-2 text-sm font-medium transition disabled:opacity-60",
				variant === "primary"
					? "bg-[var(--auth-accent)] text-[var(--auth-accent-fg)] hover:opacity-90"
					: "border border-dashed border-[var(--auth-accent)] text-[var(--auth-fg)] hover:bg-[var(--auth-border)]",
				className,
			)}
		>
			{loading ? "Please wait…" : children}
		</button>
	);
}
```

- [ ] **Step 5: Implement `AuthError.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function AuthError({
	message,
	className,
}: {
	message: string | null;
	className?: string;
}) {
	if (!message) {
		return null;
	}
	return (
		<p
			role="alert"
			className={cn(
				"rounded-[var(--auth-radius)] bg-[var(--auth-error)]/10 px-3 py-2 text-sm text-[var(--auth-error)]",
				className,
			)}
		>
			{message}
		</p>
	);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/auth/__tests__/primitives.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
npx biome check --write src/components/auth/
git add src/components/auth/AuthField.tsx src/components/auth/AuthButton.tsx src/components/auth/AuthError.tsx src/components/auth/__tests__/primitives.test.tsx
git commit -m "feat(auth): add token-themed AuthField/AuthButton/AuthError primitives"
```

---

## Task 6: AuthCard shell

**Files:**
- Create: `src/components/auth/AuthCard.tsx`

- [ ] **Step 1: Implement `AuthCard.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { useAuthConfig } from "./AuthConfigProvider";
import type { SlotClassNames } from "./types";

export function AuthCard({
	title,
	subtitle,
	children,
	classNames,
}: {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	classNames?: SlotClassNames<"root" | "card" | "header">;
}) {
	const config = useAuthConfig();
	return (
		<div
			className={cn(
				"flex min-h-screen items-center justify-center bg-[var(--auth-bg)] p-4",
				classNames?.root,
			)}
		>
			<div
				className={cn(
					"w-full max-w-sm rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-6 shadow-sm",
					classNames?.card,
				)}
			>
				<div className={cn("mb-5 text-center", classNames?.header)}>
					{config.logo ?? (
						<span className="text-base font-semibold text-[var(--auth-fg)]">
							{config.appName}
						</span>
					)}
					<h1 className="mt-2 text-lg font-semibold text-[var(--auth-fg)]">{title}</h1>
					{subtitle ? (
						<p className="mt-1 text-sm text-[var(--auth-muted)]">{subtitle}</p>
					) : null}
				</div>
				{children}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
npx biome check --write src/components/auth/AuthCard.tsx
git add src/components/auth/AuthCard.tsx
git commit -m "feat(auth): add AuthCard centered-card shell"
```

---

## Task 7: TestLoginButton (TDD)

**Files:**
- Create: `src/components/auth/TestLoginButton.tsx`
- Test: `src/components/auth/__tests__/TestLoginButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignIn: () => ({ isLoaded: true, signIn: { create }, setActive }),
}));

import { TestLoginButton } from "../TestLoginButton";

describe("TestLoginButton", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		create.mockReset();
		setActive.mockReset();
	});

	it("renders nothing without a test instance + creds", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_live_x");
		const { container } = render(<TestLoginButton onSuccess={() => {}} />);
		expect(container.firstChild).toBeNull();
	});

	it("signs in with env creds when shown and clicked", async () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
		vi.stubEnv("VITE_TEST_USER_EMAIL", "test@test.com");
		vi.stubEnv("VITE_TEST_USER_PASSWORD", "appelent_test");
		create.mockResolvedValue({ status: "complete", createdSessionId: "sess_1" });
		const onSuccess = vi.fn();

		render(<TestLoginButton onSuccess={onSuccess} />);
		screen.getByRole("button", { name: /test/i }).click();
		await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: "sess_1" }));
		expect(create).toHaveBeenCalledWith({
			identifier: "test@test.com",
			password: "appelent_test",
		});
		expect(onSuccess).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/TestLoginButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TestLoginButton.tsx`**

```tsx
import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { shouldShowTestLogin } from "@/lib/authEnv";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { clerkErrorMessage } from "./types";

export function TestLoginButton({ onSuccess }: { onSuccess: () => void }) {
	const { isLoaded, signIn, setActive } = useSignIn();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!shouldShowTestLogin(import.meta.env)) {
		return null;
	}

	async function loginTestUser() {
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			const result = await signIn.create({
				identifier: import.meta.env.VITE_TEST_USER_EMAIL as string,
				password: import.meta.env.VITE_TEST_USER_PASSWORD as string,
			});
			if (result.status === "complete") {
				await setActive({ session: result.createdSessionId });
				onSuccess();
			} else {
				setError("Test user requires additional steps.");
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-2 flex flex-col gap-1">
			<AuthButton type="button" variant="ghost" loading={loading} onClick={loginTestUser}>
				▶ Dev: log in as test user
			</AuthButton>
			<AuthError message={error} />
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/auth/__tests__/TestLoginButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/components/auth/
git add src/components/auth/TestLoginButton.tsx src/components/auth/__tests__/TestLoginButton.test.tsx
git commit -m "feat(auth): add dev-only TestLoginButton"
```

---

## Task 8: SignInForm (TDD)

**Files:**
- Create: `src/components/auth/SignInForm.tsx`
- Test: `src/components/auth/__tests__/SignInForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignIn: () => ({ isLoaded: true, signIn: { create }, setActive }),
}));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignInForm } from "../SignInForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignInForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("SignInForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		create.mockReset();
		setActive.mockReset();
	});

	it("submits credentials and activates the session", async () => {
		create.mockResolvedValue({ status: "complete", createdSessionId: "s1" });
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: "s1" }));
		expect(onSuccess).toHaveBeenCalled();
	});

	it("shows a readable error on failure", async () => {
		create.mockRejectedValue({ errors: [{ message: "Invalid." }] });
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText("Invalid.")).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/SignInForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SignInForm.tsx`**

```tsx
import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthButton } from "./AuthButton";
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
		<form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/auth/__tests__/SignInForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/components/auth/
git add src/components/auth/SignInForm.tsx src/components/auth/__tests__/SignInForm.test.tsx
git commit -m "feat(auth): add custom SignInForm"
```

---

## Task 9: SignUpForm with email verification (TDD)

**Files:**
- Create: `src/components/auth/SignUpForm.tsx`
- Test: `src/components/auth/__tests__/SignUpForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const prepare = vi.fn();
const attempt = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignUp: () => ({
		isLoaded: true,
		signUp: {
			create,
			prepareEmailAddressVerification: prepare,
			attemptEmailAddressVerification: attempt,
			createdSessionId: "s1",
		},
		setActive,
	}),
}));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignUpForm } from "../SignUpForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignUpForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("SignUpForm", () => {
	afterEach(() => {
		cleanup();
		for (const m of [create, prepare, attempt, setActive]) m.mockReset();
	});

	it("moves to the verification step after creating the account", async () => {
		create.mockResolvedValue({});
		prepare.mockResolvedValue({});
		renderForm();
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
		fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw12345!" } });
		fireEvent.click(screen.getByRole("button", { name: /create account/i }));
		expect(await screen.findByLabelText(/verification code/i)).toBeDefined();
		expect(prepare).toHaveBeenCalledWith({ strategy: "email_code" });
	});

	it("verifies the code and completes sign-up", async () => {
		create.mockResolvedValue({});
		prepare.mockResolvedValue({});
		attempt.mockResolvedValue({ status: "complete" });
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
		fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw12345!" } });
		fireEvent.click(screen.getByRole("button", { name: /create account/i }));
		const code = await screen.findByLabelText(/verification code/i);
		fireEvent.change(code, { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: /verify/i }));
		await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: "s1" }));
		expect(onSuccess).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/SignUpForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SignUpForm.tsx`**

```tsx
import { useSignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { clerkErrorMessage } from "./types";

export function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
	const { isLoaded, signUp, setActive } = useSignUp();
	const config = useAuthConfig();
	const [step, setStep] = useState<"details" | "verify">("details");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submitDetails(e: React.FormEvent) {
		e.preventDefault();
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			await signUp.create({ emailAddress: email, password });
			await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
			setStep("verify");
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function submitCode(e: React.FormEvent) {
		e.preventDefault();
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			const result = await signUp.attemptEmailAddressVerification({ code });
			if (result.status === "complete") {
				await setActive({ session: signUp.createdSessionId });
				onSuccess();
			} else {
				setError("Invalid or incomplete verification.");
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	if (step === "verify") {
		return (
			<form onSubmit={submitCode} className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-[var(--auth-muted)]">
					We sent a code to {email}.
				</p>
				<AuthField
					label="Verification code"
					type="text"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthButton loading={loading}>Verify</AuthButton>
			</form>
		);
	}

	return (
		<form onSubmit={submitDetails} className="flex flex-col gap-3">
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
				autoComplete="new-password"
				value={password}
				onChange={setPassword}
				required
			/>
			<AuthButton loading={loading}>Create account</AuthButton>
			<div className="mt-1 text-center text-xs text-[var(--auth-muted)]">
				<a href={config.paths.signIn} className="hover:underline">
					Already have an account? Sign in
				</a>
			</div>
		</form>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/auth/__tests__/SignUpForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/components/auth/
git add src/components/auth/SignUpForm.tsx src/components/auth/__tests__/SignUpForm.test.tsx
git commit -m "feat(auth): add custom SignUpForm with email-code verification"
```

---

## Task 10: ForgotPasswordForm (TDD)

**Files:**
- Create: `src/components/auth/ForgotPasswordForm.tsx`
- Test: `src/components/auth/__tests__/ForgotPasswordForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const attemptFirstFactor = vi.fn();
const setActive = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useSignIn: () => ({ isLoaded: true, signIn: { create, attemptFirstFactor }, setActive }),
}));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { ForgotPasswordForm } from "../ForgotPasswordForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<ForgotPasswordForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("ForgotPasswordForm", () => {
	afterEach(() => {
		cleanup();
		for (const m of [create, attemptFirstFactor, setActive]) m.mockReset();
	});

	it("requests a reset code then sets a new password", async () => {
		create.mockResolvedValue({});
		attemptFirstFactor.mockResolvedValue({ status: "complete", createdSessionId: "s1" });
		const onSuccess = vi.fn();
		renderForm(onSuccess);

		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		await vi.waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				strategy: "reset_password_email_code",
				identifier: "a@b.com",
			}),
		);

		fireEvent.change(await screen.findByLabelText(/code/i), { target: { value: "123456" } });
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
		await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: "s1" }));
		expect(onSuccess).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/ForgotPasswordForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ForgotPasswordForm.tsx`**

```tsx
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
			await signIn.create({ strategy: "reset_password_email_code", identifier: email });
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
			<form onSubmit={resetPassword} className="flex flex-col gap-3">
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
		<form onSubmit={requestCode} className="flex flex-col gap-3">
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/auth/__tests__/ForgotPasswordForm.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/components/auth/
git add src/components/auth/ForgotPasswordForm.tsx src/components/auth/__tests__/ForgotPasswordForm.test.tsx
git commit -m "feat(auth): add ForgotPasswordForm reset flow"
```

---

## Task 11: Auth routes

**Files:**
- Create: `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`

> These wrap the forms, own navigation via `useNavigate`, and redirect already-signed-in users to `afterAuth`. After creating route files, the route tree regenerates via `npm run dev` / `npx tsr generate`; commit the regenerated `src/routeTree.gen.ts`.

- [ ] **Step 1: Implement `src/routes/sign-in.tsx`**

```tsx
import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";

export const Route = createFileRoute("/sign-in")({ ssr: false, component: SignInPage });

function SignInPage() {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();

	// Literal route path — TanStack Router types `to` to known routes, so it
	// cannot be a plain string from AuthConfig.
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
```

- [ ] **Step 2: Implement `src/routes/sign-up.tsx`**

```tsx
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

- [ ] **Step 3: Implement `src/routes/forgot-password.tsx`**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const Route = createFileRoute("/forgot-password")({
	ssr: false,
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	return (
		<AuthCard title="Reset your password">
			<ForgotPasswordForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
```

- [ ] **Step 4: Regenerate routes + type-check**

Run: `npx tsr generate` then `npx tsc --noEmit`
Expected: routes added to `src/routeTree.gen.ts`; type-check passes.

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/routes/sign-in.tsx src/routes/sign-up.tsx src/routes/forgot-password.tsx
git add src/routes/sign-in.tsx src/routes/sign-up.tsx src/routes/forgot-password.tsx src/routeTree.gen.ts
git commit -m "feat(auth): add /sign-in, /sign-up, /forgot-password routes"
```

---

## Task 12: Point Clerk redirects at custom routes

**Files:**
- Modify: `src/integrations/clerk/provider.tsx`

- [ ] **Step 1: Add signInUrl/signUpUrl to ClerkProvider**

Replace the `<ClerkProvider …>` opening tag:

```tsx
		<ClerkProvider
			publishableKey={PUBLISHABLE_KEY}
			afterSignOutUrl="/"
			signInUrl="/sign-in"
			signUpUrl="/sign-up"
		>
```

- [ ] **Step 2: Manual check**

Run: `npm run dev` (with `npx convex dev` running). Visit a protected route while signed out (e.g. `/dashboard`).
Expected: `<RedirectToSignIn>` in `AppShell` now redirects to `/sign-in` (custom page), not Clerk's hosted UI.

- [ ] **Step 3: Commit**

```bash
npx biome check --write src/integrations/clerk/provider.tsx
git add src/integrations/clerk/provider.tsx
git commit -m "feat(auth): route Clerk redirects to custom /sign-in and /sign-up"
```

---

## Task 13: ThemeSync component

**Files:**
- Create: `src/components/ThemeSync.tsx`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Implement `ThemeSync.tsx`**

```tsx
import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { applyThemeMode, getInitialMode, reconcileTheme, setThemeMode } from "@/lib/theme";

/**
 * On sign-in, reconcile the theme stored in Clerk unsafeMetadata with
 * localStorage. localStorage stays the pre-paint source (no FOUC); Clerk is the
 * cross-device canonical store. Renders nothing.
 */
export function ThemeSync() {
	const { isLoaded, isSignedIn, user } = useUser();

	useEffect(() => {
		if (!isLoaded || !isSignedIn || !user) {
			return;
		}
		const next = reconcileTheme(user.unsafeMetadata?.theme, getInitialMode());
		if (next) {
			setThemeMode(next);
		} else {
			applyThemeMode(getInitialMode());
		}
	}, [isLoaded, isSignedIn, user]);

	return null;
}
```

- [ ] **Step 2: Mount it in `__root.tsx`**

Import at top: `import { ThemeSync } from "../components/ThemeSync";`
Inside `<ConvexProvider>`, directly above `{children}`:

```tsx
					<ThemeSync />
					{children}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
npx biome check --write src/components/ThemeSync.tsx src/routes/__root.tsx
git add src/components/ThemeSync.tsx src/routes/__root.tsx
git commit -m "feat(auth): sync theme from Clerk metadata on sign-in"
```

---

## Task 14: Write theme to Clerk on change

**Files:**
- Modify: `src/components/account/AppearanceSettings.tsx`

> `setThemeMode` stays a pure DOM/localStorage function (used pre-auth). The Clerk write happens in the component, which already has the user via a hook.

- [ ] **Step 1: Persist to Clerk in `selectMode`**

Add import: `import { useUser } from "@clerk/clerk-react";`
Inside `AppearanceSettings`, add: `const { user } = useUser();`
Replace `selectMode`:

```tsx
	function selectMode(next: ThemeMode) {
		setMode(next);
		setThemeMode(next);
		if (user) {
			user
				.update({ unsafeMetadata: { ...user.unsafeMetadata, theme: next } })
				.catch(() => {
					// non-fatal: local theme already applied
				});
		}
	}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual check**

Run the app, sign in, change theme on `/account`. Reload in a different browser/session signed in as the same user → theme persists.

- [ ] **Step 4: Commit**

```bash
npx biome check --write src/components/account/AppearanceSettings.tsx
git add src/components/account/AppearanceSettings.tsx
git commit -m "feat(auth): persist theme preference to Clerk unsafeMetadata"
```

---

## Task 15: ProfilePanel + account route swap (TDD)

**Files:**
- Create: `src/components/auth/ProfilePanel.tsx`
- Test: `src/components/auth/__tests__/ProfilePanel.test.tsx`
- Modify: `src/routes/account/index.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const updatePassword = vi.fn();
const signOut = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
	useUser: () => ({
		isLoaded: true,
		isSignedIn: true,
		user: {
			firstName: "Eric",
			lastName: "Jansen",
			primaryEmailAddress: { emailAddress: "e@x.com" },
			update,
			updatePassword,
		},
	}),
	useClerk: () => ({ signOut }),
}));

import { ProfilePanel } from "../ProfilePanel";

describe("ProfilePanel", () => {
	afterEach(() => {
		cleanup();
		for (const m of [update, updatePassword, signOut]) m.mockReset();
	});

	it("saves name changes", async () => {
		update.mockResolvedValue({});
		render(<ProfilePanel />);
		fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Erik" } });
		fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
		await vi.waitFor(() =>
			expect(update).toHaveBeenCalledWith({ firstName: "Erik", lastName: "Jansen" }),
		);
	});

	it("signs out", () => {
		render(<ProfilePanel />);
		fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/__tests__/ProfilePanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ProfilePanel.tsx`**

```tsx
import { useClerk, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { AppearanceSettings } from "@/components/account/AppearanceSettings";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { clerkErrorMessage } from "./types";

export function ProfilePanel() {
	const { isLoaded, user } = useUser();
	const { signOut } = useClerk();
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);

	useEffect(() => {
		if (user) {
			setFirstName(user.firstName ?? "");
			setLastName(user.lastName ?? "");
		}
	}, [user]);

	if (!isLoaded || !user) {
		return <p className="text-sm text-[var(--auth-muted)]">Loading…</p>;
	}

	async function saveProfile(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSavingProfile(true);
		try {
			await user.update({ firstName, lastName });
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setSavingProfile(false);
		}
	}

	async function changePassword(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSavingPassword(true);
		try {
			await user.updatePassword({ currentPassword, newPassword });
			setCurrentPassword("");
			setNewPassword("");
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setSavingPassword(false);
		}
	}

	return (
		<div className="space-y-6">
			<AuthError message={error} />

			<section className="rm-panel p-4">
				<p className="rm-label">Profile</p>
				<form onSubmit={saveProfile} className="mt-3 flex flex-col gap-3">
					<AuthField label="First name" type="text" value={firstName} onChange={setFirstName} />
					<AuthField label="Last name" type="text" value={lastName} onChange={setLastName} />
					<p className="text-xs text-[var(--auth-muted)]">
						Email: {user.primaryEmailAddress?.emailAddress}
					</p>
					<AuthButton loading={savingProfile}>Save profile</AuthButton>
				</form>
			</section>

			<section className="rm-panel p-4">
				<p className="rm-label">Security</p>
				<form onSubmit={changePassword} className="mt-3 flex flex-col gap-3">
					<AuthField
						label="Current password"
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						onChange={setCurrentPassword}
					/>
					<AuthField
						label="New password"
						type="password"
						autoComplete="new-password"
						value={newPassword}
						onChange={setNewPassword}
					/>
					<AuthButton loading={savingPassword}>Change password</AuthButton>
				</form>
			</section>

			<AppearanceSettings />

			<section className="rm-panel p-4">
				<p className="rm-label">Session</p>
				<div className="mt-3">
					<AuthButton type="button" variant="ghost" onClick={() => signOut()}>
						Sign out
					</AuthButton>
				</div>
			</section>
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/auth/__tests__/ProfilePanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Swap `/account` to use ProfilePanel**

In `src/routes/account/index.tsx`, remove the `UserProfile` import and its usage; replace the body:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProfilePanel } from "@/components/auth/ProfilePanel";
import { AppShell } from "@/components/AppShell";

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
				<ProfilePanel />
			</div>
		</AppShell>
	);
}
```

> Note: `AppearanceSettings` is now rendered inside `ProfilePanel`, so it is removed from the route to avoid duplication.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit` (PASS)

```bash
npx biome check --write src/components/auth/ src/routes/account/index.tsx
git add src/components/auth/ProfilePanel.tsx src/components/auth/__tests__/ProfilePanel.test.tsx src/routes/account/index.tsx
git commit -m "feat(auth): custom ProfilePanel replaces Clerk UserProfile on /account"
```

---

## Task 16: Custom HeaderUser

**Files:**
- Modify: `src/integrations/clerk/header-user.tsx`

- [ ] **Step 1: Replace with a custom header user control**

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
						<div
							className={cn(
								"absolute right-0 mt-2 w-40 rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-1 shadow-md",
							)}
						>
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
				<Link
					to="/sign-in"
					className="text-sm font-medium text-[var(--auth-fg)] hover:underline"
				>
					Sign in
				</Link>
			</SignedOut>
		</>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual check**

Run the app: header shows a custom avatar menu when signed in (Account / Sign out) and a "Sign in" link when signed out — no Clerk `<UserButton>`/`<SignInButton>` branding.

- [ ] **Step 4: Commit**

```bash
npx biome check --write src/integrations/clerk/header-user.tsx
git add src/integrations/clerk/header-user.tsx
git commit -m "feat(auth): custom HeaderUser replaces Clerk UserButton/SignInButton"
```

---

## Task 17: Env vars + wrangler dev vars

**Files:**
- Modify: `.env.example`, `wrangler.jsonc`

- [ ] **Step 1: Document the test-user vars in `.env.example`**

Append (keys only, no real secrets):

```
# Dev-only test login (set on test instance / dev worker only; leave unset in prod)
VITE_TEST_USER_EMAIL=
VITE_TEST_USER_PASSWORD=
```

- [ ] **Step 2: Add dev vars to `wrangler.jsonc`**

Update the `env.dev` block so the dev worker carries the test creds (the prod top-level config does NOT):

```jsonc
	"env": {
		"dev": {
			"name": "archstudio-dev",
			"workers_dev": true,
			"vars": {
				"VITE_TEST_USER_EMAIL": "test@test.com",
				"VITE_TEST_USER_PASSWORD": "appelent_test"
			}
		}
	}
```

- [ ] **Step 3: Set local dev values**

Add to `.env.local` (gitignored — do NOT commit):

```
VITE_TEST_USER_EMAIL=test@test.com
VITE_TEST_USER_PASSWORD=appelent_test
```

Verify `.env.local` is gitignored: `git check-ignore .env.local` → prints `.env.local`.

- [ ] **Step 4: Commit (config only — not .env.local)**

```bash
git add .env.example wrangler.jsonc
git commit -m "chore(auth): document and wire dev test-login env vars"
```

---

## Task 18: Full verification

- [ ] **Step 1: Lint + format**

Run: `npm run check`
Expected: exit 0, no errors.

- [ ] **Step 2: Type check (app + convex)**

Run: `npx tsc --noEmit` then `npx convex dev --once`
Expected: both pass; no `convex/_generated` diff.

- [ ] **Step 3: Full test suite**

Run: `npm run test`
Expected: all pass, including the new auth tests.

- [ ] **Step 4: Production build smoke test**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual end-to-end (dev)**

With `npx convex dev` + `npm run dev` (test Clerk instance, `.env.local` creds set):
- `/sign-in` shows the custom centered card + the "Dev: log in as test user" button.
- Test-login button signs in and lands on `/dashboard`.
- `/sign-up` runs the two-step flow; `/forgot-password` runs the reset flow.
- `/account` shows the custom ProfilePanel; theme change persists across a fresh signed-in session.
- Header shows the custom avatar menu / Sign-in link.

- [ ] **Step 6: Final commit (if any formatting/regen remains)**

```bash
git add -A
git commit -m "chore(auth): final verification pass"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** approach (Tasks 5–10, 15–16), routes (11), theming tokens + slot classNames (1, 5), test-login + env detection (2, 7, 17), theme→Clerk sync + FOUC-safe (3, 13, 14), app-specific settings deferred (no task — intentional, documented in spec), social seam (`AuthConfig.socialProviders` in Task 4 + conditional render hooks; full flow intentionally not built).
- **Type consistency:** `clerkErrorMessage`, `AuthConfig`, `shouldShowTestLogin`, `reconcileTheme`, and the `onSuccess` form prop are defined once (Tasks 2–5) and reused with identical signatures throughout.
- **Out of scope (no tasks, by design):** social login flow, MFA/orgs, avatar upload, Convex `userSettings` table.
- **Ops dependency:** the `test@test.com` / `appelent_test` user must exist on the Clerk **test** instance for Task 18 Step 5 to pass (create it in the Clerk dashboard). Assumes the instance requires `email_code` sign-up verification; if not, Task 9's verify step is skipped by Clerk (status `complete` immediately) — handle by checking `result.status` (already done).

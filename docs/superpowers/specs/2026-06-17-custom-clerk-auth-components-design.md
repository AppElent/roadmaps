# Custom, Portable Clerk Auth Components — Design

**Date:** 2026-06-17
**Status:** Approved (design); pending implementation plan
**App:** ArchStudio (roadmaps repo). Components designed to be copy-portable into other TanStack Start + Clerk apps (workouts, satisfactory).

## Goal

Replace ArchStudio's Clerk-branded auth UI (hosted/modal `<SignIn>`, `<SignUp>`, `<UserButton>`, `<UserProfile>`) with a set of **fully custom, reusable, themeable** auth components built on Clerk's React hooks. The components must:

- Be unbranded and styled to the host app via design tokens + per-slot class overrides (portable across the user's apps).
- Provide sign-in, sign-up (with email verification), forgot-password, and a custom profile/account panel.
- Offer a **dev-only test-login button** in non-production environments.
- Support saving generic UI prefs (theme) to Clerk, with a documented split for app-specific settings.
- Leave a clean seam for **social login providers** (not built now).

## Non-Goals (YAGNI)

- Social/OAuth login (seam only — not implemented).
- MFA, organizations, multi-session management.
- Avatar upload in the custom profile (Clerk's default avatar is shown read-only for now).
- Convex `userSettings` table (pattern documented; built later when a concrete app-global setting exists).

## Decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Approach | Fully custom components on Clerk hooks; portable/themeable across apps |
| Presentation | Dedicated routes `/sign-in`, `/sign-up`, `/forgot-password`; profile at `/account` |
| Theming API | `--auth-*` CSS-variable token defaults **plus** optional per-slot `classNames` props merged via `cn()` |
| Profile | Custom `ProfilePanel` fully replaces Clerk `<UserProfile>`; custom `HeaderUser` replaces `<UserButton>` |
| Page layout | Layout A — centered card (`AuthCard` shell) |
| Theme storage | Clerk `unsafeMetadata` (canonical sync) + localStorage (pre-paint source); reconcile on sign-in |
| App-specific settings | Convex `userSettings` (deferred until a real setting appears) |
| Test-login visibility | `pk_test_` Clerk key **and** test-cred env vars present |
| Test creds | Env vars only (never hardcoded), absent in prod |
| Social providers | Config seam (`socialProviders: []`), not implemented |

## Architecture

### Module location
`src/components/auth/` — a self-contained module with no hard dependency on ArchStudio-specific classes. Internal styling references only `--auth-*` tokens and accepts `classNames` overrides, so the folder can be copied into another app and themed by defining the tokens there.

### Configuration: `AuthConfig`
A lightweight config object provided via a small React context (`AuthConfigProvider`) with sensible defaults, so each app supplies its own branding and links:

```ts
interface AuthConfig {
  appName: string;              // "ArchStudio"
  logo?: React.ReactNode;       // logo slot for AuthCard
  paths: {
    signIn: string;             // "/sign-in"
    signUp: string;             // "/sign-up"
    forgotPassword: string;     // "/forgot-password"
    afterAuth: string;          // "/dashboard"
    account: string;            // "/account"
  };
  features: {
    forgotPassword: boolean;    // true
  };
  socialProviders: SocialProvider[]; // [] for now
}
```

Cross-links between forms read paths from this config (not hardcoded), which is what makes the components portable.

### Clerk provider changes
`src/integrations/clerk/provider.tsx`: add `signInUrl="/sign-in"` and `signUpUrl="/sign-up"` to `<ClerkProvider>` so `<RedirectToSignIn>` (in `AppShell`) and any Clerk-initiated redirects route to the custom pages instead of Clerk's hosted UI. Keep `afterSignOutUrl="/"`.

## Components

### Primitives (token-themed, slot-overridable)
- **`AuthField`** — label + input + inline error. Props: `label`, `type`, `value`, `onChange`, `error`, `classNames?: { root; label; input; error }`.
- **`AuthButton`** — primary/secondary/ghost variants; `loading` state. `classNames?`.
- **`AuthError`** — form-level error banner (maps Clerk error arrays to readable text).

### `AuthCard`
Centered-card layout shell (Layout A): subtle gradient background, card container, logo slot from `AuthConfig`, title, and `children`. `classNames?: { root; card; header }`.

### `SignInForm`
- Uses `useSignIn`. Email + password fields → `signIn.create({ identifier, password })` → `setActive({ session })` → navigate to `afterAuth`.
- Loading + error states (invalid credentials, unverified, etc.).
- Renders `TestLoginButton` (conditionally) and links to sign-up + forgot-password (from config).

### `SignUpForm`
Two-step, single route, internal step state:
1. **Details:** email, password, optional first/last name → `signUp.create({...})` → `prepareEmailAddressVerification({ strategy: "email_code" })` → advance to step 2.
2. **Verify (`VerifyEmailForm`):** 6-digit code → `signUp.attemptEmailAddressVerification({ code })` → `setActive` → navigate.
- Error handling: existing email, weak/breached password, invalid/expired code; "resend code" action.

### `ForgotPasswordForm`
Two-step via `useSignIn`:
1. Email → `signIn.create({ strategy: "reset_password_email_code", identifier })`.
2. Code + new password → `signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password })` → `setActive`.

### `ProfilePanel`
Custom replacement for Clerk `<UserProfile>`, using `useUser` / `useClerk`:
- **Profile:** edit first/last name → `user.update(...)`. Clerk avatar shown read-only (upload deferred).
- **Email:** change email → add email + `prepareVerification` + verify code; set primary.
- **Security:** change password → `user.updatePassword(...)`.
- **Appearance:** embeds the existing `AppearanceSettings` (now Clerk-synced — see Theme Sync).
- **Sign out** action.
- Sections are individually themeable; built from the same primitives.

### `HeaderUser`
Replaces Clerk `<UserButton>`. Custom avatar/initials button with a small menu: link to `/account`, sign out via `useClerk().signOut`. Uses `<SignedIn>`/`<SignedOut>` for gating; signed-out shows a link to `/sign-in` (replacing `<SignInButton>`).

### `TestLoginButton`
- Renders only when `shouldShowTestLogin(env)` is true.
- On click: `useSignIn().signIn.create({ identifier: VITE_TEST_USER_EMAIL, password: VITE_TEST_USER_PASSWORD })` → `setActive` → navigate. Shows loading/error like the normal form.
- Visually marked as a dev affordance (e.g. dashed/ghost styling, "Dev" label).

## Theming

Components ship default Tailwind styling keyed to CSS variables. The host app maps tokens to its own palette. ArchStudio maps `--auth-*` to its `--rm-*` tokens in `src/styles.css`.

Token set (initial): `--auth-bg`, `--auth-fg`, `--auth-muted`, `--auth-card-bg`, `--auth-border`, `--auth-radius`, `--auth-field-bg`, `--auth-accent`, `--auth-accent-fg`, `--auth-error`.

Every component also accepts an optional `classNames` slot map merged via `cn()` for structural/spacing overrides without editing the component. No `appearance`-style nested config object (rejected as over-built for current needs).

## Environment & test-login

- **Detection helper** (`src/lib/authEnv.ts`): `shouldShowTestLogin(env)` returns true when `env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")` **and** both `env.VITE_TEST_USER_EMAIL` and `env.VITE_TEST_USER_PASSWORD` are non-empty. Pure function over an injected env object → unit-testable.
- **Env vars:** `VITE_TEST_USER_EMAIL`, `VITE_TEST_USER_PASSWORD` added to `.env.local` (dev) and the `archstudio-dev` worker's `env.dev.vars` in `wrangler.jsonc`. Documented keys-only in `.env.example`. **Not set in prod** → button hidden and credential strings excluded from the prod bundle (guarded by the runtime check; values come from env, never literals).
- Values for the seeded Clerk test user: `test@test.com` / `appelent_test` (created on the test Clerk instance; provisioning is an ops step, noted in the plan).

## Settings / metadata storage

### Theme (generic UI pref) → Clerk `unsafeMetadata` + localStorage
- **Pre-paint:** `THEME_INIT_SCRIPT` in `__root.tsx` continues to read localStorage (unchanged) to avoid FOUC.
- **Canonical sync:** `src/lib/theme.ts` gains:
  - A reconcile-on-sign-in path: a dedicated `ThemeSync` component (uses `useUser()`) mounted once at the root inside the Clerk/Convex providers in `__root.tsx`, so it runs app-wide regardless of route. When it resolves a signed-in user, it reads `user.unsafeMetadata.theme`; if present and differs from localStorage, it applies + persists to localStorage. Renders nothing.
  - `setThemeMode(mode)` continues to write localStorage and apply, and additionally — when signed in — fires `user.update({ unsafeMetadata: { ...user.unsafeMetadata, theme: mode } })` (fire-and-forget; failure is non-fatal).
- `AppearanceSettings` calls the synced setter; no UI change.

### App-specific user-global settings → Convex (deferred)
Documented pattern: a `userSettings` table keyed by `userId` (Clerk subject), with server-side `requireUser` ownership, for future settings like default landing tool or new-roadmap defaults. **Not created in this feature** (no concrete setting yet). Per-entity prefs already on rows (roadmap zoom, `barColorMode`) stay where they are.

## Social providers (future seam)

- `AuthConfig.socialProviders: SocialProvider[]` defaults to `[]`.
- `SignInForm`/`SignUpForm` render a social-button row only when the list is non-empty.
- When added later: `signIn.authenticateWithRedirect({ strategy, redirectUrl: "/sso-callback", redirectUrlComplete: afterAuth })` plus a `/sso-callback` route rendering Clerk's `<AuthenticateWithRedirectCallback/>`. Documented, not implemented.

## Routing summary

| Route | Renders | Notes |
|-------|---------|-------|
| `/sign-in` | `AuthCard` + `SignInForm` | public, `ssr: false` |
| `/sign-up` | `AuthCard` + `SignUpForm` (2-step) | public, `ssr: false` |
| `/forgot-password` | `AuthCard` + `ForgotPasswordForm` (2-step) | public, `ssr: false` |
| `/account` | `AppShell` + `ProfilePanel` | replaces `<UserProfile>` |
| `/sso-callback` | (future) `<AuthenticateWithRedirectCallback/>` | not built now |

`AppShell`'s `<RedirectToSignIn>` resolves to `/sign-in` via `ClerkProvider` `signInUrl`. Header `HeaderUser` replaces `<SignInButton>`/`<UserButton>`.

## Testing

- **Unit (node env):**
  - `shouldShowTestLogin` — truth table across `pk_test_`/`pk_live_` × creds present/absent.
  - Theme reconcile logic — Clerk-metadata-vs-localStorage precedence.
- **Component (jsdom, `// @vitest-environment jsdom`):**
  - Mock Clerk hooks (`useSignIn`, `useSignUp`, `useUser`, `useClerk`) via a test util.
  - `SignInForm`: submit success → `setActive` called; error path renders `AuthError`.
  - `SignUpForm`: step 1 → step 2 transition; verify success.
  - `ForgotPasswordForm`: two-step transition.
  - `TestLoginButton`: visible/hidden per injected env; click triggers programmatic sign-in.
- No weakening/skipping of tests to pass. `npm run check` + `npx tsc --noEmit` must pass.

## Files (anticipated)

**New:**
- `src/components/auth/AuthConfigProvider.tsx`, `AuthCard.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `VerifyEmailForm.tsx`, `ForgotPasswordForm.tsx`, `ProfilePanel.tsx`, `HeaderUser.tsx`, `TestLoginButton.tsx`, primitives (`AuthField.tsx`, `AuthButton.tsx`, `AuthError.tsx`), `types.ts`.
- `src/lib/authEnv.ts` (+ test), theme-sync additions in `src/lib/theme.ts` (+ test), `src/components/ThemeSync.tsx`.
- Routes: `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`.
- `--auth-*` token definitions in `src/styles.css`.

**Modified:**
- `src/integrations/clerk/provider.tsx` (signInUrl/signUpUrl).
- `src/integrations/clerk/header-user.tsx` → custom `HeaderUser` (or replace usage).
- `src/routes/account/index.tsx` (`ProfilePanel` instead of `<UserProfile>`).
- `src/components/account/AppearanceSettings.tsx` (synced setter).
- `.env.example`, `wrangler.jsonc` (`env.dev.vars`).

## Open items for the implementation plan
- Provisioning the `test@test.com` Clerk test user (ops step, outside code).
- Confirm the Clerk instance's sign-up requires `email_code` verification (assumed; adjust the flow if the instance is configured otherwise).

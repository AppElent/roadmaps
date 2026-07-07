---
name: verify
description: Verify a change in ArchStudio by driving the running app and observing behaviour (not just running tests). Use when asked to verify a change, confirm a fix works, or validate a diff locally before pushing.
---

# Verify a change in ArchStudio

Local-first: this drives the real dev server via the Claude Preview tools. On web
(no Convex/Clerk runtime credentials) fall back to the static suite — `pnpm run check`,
`pnpm run typecheck`, `pnpm test` — and say so rather than pretending the app was driven.

## Setup

1. Start via `preview_start` with `.claude/launch.json`'s "All (dev:watch)" config
   (Convex backend + Vite together; port 3000).
2. Seed demo data if the backend is empty: `pnpm run seed`.
3. Auth: the sign-in screen shows a "▶ Dev: log in as test user" button (from
   `@appelent/auth`'s `TestLoginButton`). It appears only when
   `VITE_CLERK_PUBLISHABLE_KEY` is a `pk_test_...` key AND both `VITE_TEST_USER_EMAIL`
   / `VITE_TEST_USER_PASSWORD` are set — if the button is missing, check `.env.local`
   for those two vars before concluding the app can't be tested logged-in. Never invent
   credentials.

## Change → what to exercise

- `src/lib/timeline.ts` → `/roadmaps/$id`: drag/resize a bar, confirm adaptive-grid
  snap + persistence after reload.
- `src/lib/fields.ts` → add a custom field, set values, confirm validation.
- `convex/sharing.ts` → open `/share/$token` logged-out: read-only, and non-"link"
  visibility 404s.
- Diagrams → edit source, confirm debounced preview + version save.

## Always

Check console logs (`preview_console_logs`) for errors; re-check the change in dark mode
and at 375px width (`preview_resize`) — the two most common regressions per
`docs/review-notes/`. Report observed behaviour, not just "tests pass."

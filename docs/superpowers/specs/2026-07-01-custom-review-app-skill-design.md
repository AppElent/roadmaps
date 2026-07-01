# `custom-review-app` global skill — design

## Purpose

A global Claude Code skill (available in every project, not just this repo) that autonomously drives a running app through its built-in "Claude Preview" browser tools, exercises it end-to-end, and produces a self-contained findings report — with no human needing to drive the browser. Complements the existing `custom-review-session` skill (human drives, Claude takes notes) with a fully automated equivalent.

## Location & invocation

- File: `C:\Users\ericj\.claude\skills\custom-review-app\SKILL.md` (global, alongside `custom-review-session`, `custom-bootstrap`, `custom-upgrade-deps`, and `webapp-testing`).
- Invoked as `/custom-review-app [scope]`, or naturally when the user asks to "review the app," "run an e2e review," "find bugs automatically," or "test what we just built."
- `scope` is optional free text (see **Scope argument** below).

## Mechanism

Drives the app via the `mcp__Claude_Preview__*` toolset already present in this harness (`preview_start`, `preview_click`, `preview_fill`, `preview_snapshot`, `preview_screenshot`, `preview_console_logs`, `preview_network`, `preview_eval`, `preview_resize`, `preview_inspect`, `preview_list`, `preview_stop`). This is what "preview mode" refers to. It reads server config from the current project's `.claude/launch.json`; if that file doesn't exist, the skill creates it from `package.json`'s dev script (mirroring how `preview_start`'s own tool description says to bootstrap it).

The skill never targets a non-local URL — `preview_start` only ever manages a local dev server, which is the built-in safety boundary against ever touching a real/production environment.

## Process

1. **Ground itself in the project**
   - Read `.claude/launch.json` (create if missing, from `package.json`).
   - Skim `README.md` / `CLAUDE.md` for the app's shape: what tools/sections exist, key routes, and any documented test-login convention.
2. **Start the preview** (`preview_start`), navigate to the root/dashboard route, `preview_snapshot` to find nav links and page structure.
3. **Resolve scope** (see below) into a concrete plan: which pages/flows to visit, and what viewport/theme state to test in.
4. **Handle auth automatically, if needed**
   - If a login wall blocks the target scope, look for an obvious test-account affordance: a Clerk dev-mode "sign in as test user" banner/button, a visible demo/test login link, or seeded credentials documented in the project's own README/CLAUDE.md.
   - If nothing like that exists, proceed with whatever is reachable unauthenticated and explicitly flag authed areas as "not covered" in the report. Never invent or guess credentials.
5. **Crawl, bounded**
   - Breadth-first from the root + discovered nav links, capped at ~20 distinct pages/views by default (fewer when `scope` narrows the target set).
   - Per page: `preview_snapshot` + `preview_screenshot` for a spot check, `preview_console_logs` for JS errors, `preview_network` (filter: `failed`) for broken requests, exercise key interactive elements (buttons, forms, CRUD included — creating/editing/deleting real data in the app is allowed, no cleanup pass required since this only ever runs against a local dev server), and a basic accessibility pass over the snapshot (missing labels/alt text/roles, obvious keyboard-nav dead ends).
   - Stop once the budget is hit or the crawl frontier is exhausted, whichever comes first.
6. **Resolve file locations as it goes**
   - When something looks off, immediately read the relevant route/component file (via the route path or by grepping for text seen in the UI) so the report names real files, not vague descriptions — same discipline as `custom-review-session`.
7. **Avoid real external side effects**
   - CRUD on the app's own data is fine. Never trigger something that would have a real-world effect outside the app itself (sending a real email, hitting a payment provider, calling a third-party webhook) even if a UI control for it exists.

## Scope argument

Free text, interpreted as one or more of:

1. **Route/section name** — e.g. `roadmaps` → narrow the crawl to that section.
2. **Viewport/theme mode** — e.g. `mobile`, `dark mode` → maps to `preview_resize`'s device presets and `colorScheme` option; the skill sets that state before crawling and looks for mode-specific issues (dark-mode contrast, mobile overflow/nav collapse, etc.).
3. **"What we just built"** — e.g. `what we just did`, `the feature we just added` → the skill runs `git diff` / `git status` (uncommitted work) or `git log -1 --stat` (if the tree is clean, meaning it was just committed) to find changed files, maps them to routes (`src/routes/**`) and components (grep for where a changed component is used) to scope the crawl to just the affected pages/flows.
4. Combinations of the above (e.g. `dark mode on the item editor`) — narrow by both page and mode when both are detectable.
5. No argument → full-app pass.

The report always states how the scope was interpreted, so it's clear what was (and wasn't) covered.

## Report

Same goal-ready template `custom-review-session` already uses (`./review-notes/*.md`, `Goal` / `Summary` / `Action Items` grouped Blocker → Major → Minor → Nice-to-have, each item with What / Where / Type / Fix direction / Acceptance), plus a **Coverage** note (pages visited, scope interpretation, whether auth was reached, whether the page budget was hit before the crawl frontier was exhausted).

- Saved to `./review-notes/auto-review-YYYY-MM-DD-HHMM.md` — same folder as manual review sessions, distinct filename prefix so the two are easy to tell apart.
- Types checked for: functional bugs, UX friction, accessibility, and any console/network errors surfaced while crawling.

## Ending

Presents the file path plus a one-line counts recap, then asks: **"Want me to fix these now?"**

- No → stop, file stays on disk.
- Yes → same handoff as `custom-review-session`: tell the user to run `/compact` to preserve review context concisely, then hand the file to Claude Code's Goals feature with a fix-everything directive (severity order, verify each item against its acceptance criteria, run typecheck/lint/tests before considering an item done).

## Out of scope

- Does not replace `npm run check` / `npx tsc --noEmit` / `npm run test` — this is a live behavioral review, not a substitute for static checks or the existing test suite.
- Does not clean up test data it creates (explicit user call: acceptable cost since this only runs against local/dev).
- Does not attempt login with guessed or invented credentials.

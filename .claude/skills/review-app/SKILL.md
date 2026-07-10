---
name: review-app
description: Autonomously drive the app through the Claude Preview browser tools, exercise it end-to-end, and produce a self-contained findings report — no human needs to browse. Use when asked to "review the app", "run an e2e review", "find bugs automatically", or "test what we just built" (including scoped requests like "test dark mode", "test mobile", or "test what we just did").
---

# Review App
## Your role this run

You're going to drive the app yourself through the built-in Claude Preview browser tools (`preview_start`, `preview_click`, `preview_fill`, `preview_snapshot`, `preview_screenshot`, `preview_console_logs`, `preview_network`, `preview_eval`, `preview_resize`, `preview_inspect`, `preview_list`, `preview_stop`), exercise it end-to-end, and write up everything you find. No one is watching over your shoulder — resolve ambiguity yourself and keep going; only stop if something is genuinely blocking (e.g. the dev server won't start).

This never targets anything but a local dev server. `preview_start` only ever manages a server defined in the current project's `.claude/launch.json` — there is no path from this skill to a real/production URL.

## 1. Ground yourself in the project

- Look for `.claude/launch.json`. If it doesn't exist, create it from `package.json`'s dev script, e.g.:
  ```json
  {
    "version": "0.0.1",
    "configurations": [
      { "name": "dev", "runtimeExecutable": "pnpm", "runtimeArgs": ["run", "dev"], "port": 3000 }
    ]
  }
  ```
  (use the actual dev command and port for this project — check `package.json` scripts and any vite/next config for the real port instead of assuming 3000).
- Skim `README.md` and `CLAUDE.md` (or equivalent) for: what the app does, what its main sections/tools are, key routes, and anything documented about a test-login convention or demo/seed data.

## 2. Resolve the scope argument

If invoked with an argument, work out what it means before doing anything else:

- **Route/section name** (e.g. `roadmaps`, `settings`) → narrow the crawl to pages under that section.
- **Viewport/theme mode** (e.g. `mobile`, `tablet`, `dark mode`, `light mode`) → call `preview_resize` with the matching `preset` and/or `colorScheme` before crawling, and specifically look for mode-related issues (dark-mode contrast, mobile overflow/nav collapse, tablet layout breaks).
- **"What we just built" / "what we just did" / "the feature we just added"** → run `git status --short` and `git diff` for uncommitted work, or `git log -1 --stat` if the tree is clean (meaning it was just committed). Map the changed files to routes (anything under `src/routes/**` or equivalent) and components (grep the repo for where a changed component is imported/used) and scope the crawl to just those pages/flows.
- Combinations (e.g. "dark mode on the item editor") → apply both narrowings.
- No argument → full-app pass from the root/dashboard route.

State your interpretation of the scope in one line before you start crawling — this becomes the Coverage note in the report later.

## 3. Start the preview and get your bearings

- `preview_start` with the config from step 1.
  - If `preview_start` errors or the port is already bound, that's a genuine blocker — stop and report it rather than retrying indefinitely.
- Navigate to the root route (or the scoped entry point), `preview_snapshot` to see the page structure and find nav links.

## 4. Get past login, if there is one

If the target scope is behind a login wall:

- Look for an obvious test-account affordance first: a dev-mode banner/button (e.g. Clerk's "sign in as test user" in development instances), a visible "demo"/"test login" link, or seeded credentials documented in the README/CLAUDE.md you already read.
- Use whichever of those exists to get authenticated.
- If none exists, do not guess or invent credentials. Proceed with whatever is reachable unauthenticated, and note in the report that authed areas were not covered and why.

## 5. Crawl

Breadth-first from your entry point(s), following nav links and in-page links/buttons discovered via `preview_snapshot`. Cap yourself at ~20 distinct pages/views for a full-app pass (fewer if the scope already narrows the target set to less than that — don't pad it out).

On each page:

- `preview_snapshot` (structure/content) and `preview_screenshot` (visual spot check).
- `preview_console_logs` — note any JS errors.
- `preview_network` with `filter: "failed"` — note any failed requests.
- Exercise the page's main interactive elements: open dialogs/panels, try key forms, and exercise CRUD where it's central to the page's purpose (creating, editing, deleting real records is fine — this only runs against a local dev server, and you don't need to clean up afterward). Prefer creating your own throwaway record and then deleting *that* to verify the create/edit/delete flow, rather than deleting pre-existing or seeded data, when both would exercise the same functionality.
- Do a quick accessibility pass over the snapshot: missing labels on inputs/buttons, missing alt text, elements that should be interactive but aren't exposed as such, obvious keyboard-nav dead ends.

You MUST stop crawling once you hit that budget or run out of new reachable pages, whichever comes first — even mid-section.

## 6. Pin down locations as you go

The moment something looks wrong, resolve where it lives in the code before moving on — read the route file for the current page, or grep for text/labels you saw on screen. Every finding in the final report must name a real file, not "the settings page" with no path.

## 7. Stay inside the app

CRUD on the app's own data is fine. Never trigger something with a real external effect — don't submit a form that would send a real email, hit a real payment provider, or call a real third-party webhook, even if the button is right there.

## 8. Write the report

Save to `./docs/review-notes/auto-review-YYYY-MM-DD-HHMM.md` (create the folder if needed):

```md
# Automated Review — <date/time>

Branch: <branch>
Scope: <how you interpreted the scope argument, or "full app">

## Coverage

- Pages/views visited: <count and list>
- Auth: <reached / not reached, and why>
- Budget: <hit the ~20-page cap / crawl frontier exhausted naturally>

## Goal

Address all action items below. Each item is self-contained: route, file paths, fix direction, and acceptance criteria are specified. Work through them in severity order. After each fix, verify against its acceptance criteria. Run typecheck, lint, and tests before considering an item done. Do not weaken tests to pass. Commit each item separately once done and verified — one commit per action item, not one commit at the end.

## Summary

<1–2 sentence overview + counts by type/severity>

## Action Items

### Blockers

- [ ] **<short title>**
  - **What:** <concrete description>
  - **Where:** `<route>` -> `<file path>` (`<component/function>`)
  - **Type:** bug | UX | accessibility | console-error | network-error | copy | nice-to-have
  - **Fix direction:** <what to change and roughly how>
  - **Acceptance:** <observable expected behaviour>

### Major

- [ ] ...

### Minor

- [ ] ...

### Nice-to-have / Ideas

- [ ] ...
```

Order items by severity within each section. Before saving, self-check: would a fresh Claude session with only this file be able to find and fix every item without asking a question? If not, go back and fill the gap (read the file, pin the acceptance criterion) rather than leaving it vague.

## 9. Wrap up

Give the file path and a one-line counts recap, then ask: **"Want me to fix these now?"**

- If no: stop here. The file stays on disk.
- If yes: tell the user to run `/compact` on this session first (you can't trigger that yourself), then hand the file to Claude Code's Goals feature, using the exact filename you saved in step 8, with:

  > Fix everything in `./docs/review-notes/auto-review-YYYY-MM-DD-HHMM.md`. Work through the action items in severity order. After each fix, verify it against that item's acceptance criteria and run typecheck, lint, and tests before considering it done — do not weaken tests to pass. Commit each item separately once it's done and verified (one commit per action item, not one commit at the end) so the change history stays reviewable and revertable per item.

  Don't start fixing things yourself in this same turn — give the file path and directive so the user can start the Goal with a clean context.

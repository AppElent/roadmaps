# custom-review-app Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the global `custom-review-app` skill — a single `SKILL.md` file that lets Claude autonomously drive a running app through the built-in Claude Preview browser tools, exercise it end-to-end, and write a goal-ready findings report, with no human at the keyboard.

**Architecture:** One skill file (no helper scripts needed — everything it needs, `preview_start`/`preview_click`/`preview_snapshot`/etc., already exists as MCP tools in the harness). It lives outside this git repo, in the user's global skills directory (`C:\Users\ericj\.claude\skills\`, confirmed **not** a git repo — no commit step applies to it). The "test" for a skill written in natural language is running it: after writing the file, we dry-run it against *this* repo with a narrow scope and fix anything that goes wrong before considering it done.

**Tech Stack:** Markdown skill file (YAML frontmatter + instructions), Claude Preview MCP tools, this repo (`D:\Dev\roadmaps\...`) as the dry-run target since it's already running dev servers and has a documented `.claude` setup.

**Reference spec:** `docs/superpowers/specs/2026-07-01-custom-review-app-skill-design.md`

---

### Task 1: Create the skill file

**Files:**
- Create: `C:\Users\ericj\.claude\skills\custom-review-app\SKILL.md`

- [ ] **Step 1: Create the directory and write the file**

Create `C:\Users\ericj\.claude\skills\custom-review-app\SKILL.md` with exactly this content:

````markdown
---
name: custom-review-app
description: Autonomously drive the app through the Claude Preview browser tools, exercise it end-to-end, and produce a self-contained findings report — no human needs to browse. Use when asked to "review the app", "run an e2e review", "find bugs automatically", or "test what we just built" (including scoped requests like "test dark mode", "test mobile", or "test what we just did").
---

# Custom Review App

## Your role this run

You're going to drive the app yourself through the built-in Claude Preview browser tools (`preview_start`, `preview_click`, `preview_fill`, `preview_snapshot`, `preview_screenshot`, `preview_console_logs`, `preview_network`, `preview_eval`, `preview_resize`, `preview_inspect`, `preview_list`, `preview_stop`), exercise it end-to-end, and write up everything you find. No one is watching over your shoulder — resolve ambiguity yourself and keep going; only stop if something is genuinely blocking (e.g. the dev server won't start).

This never targets anything but a local dev server. `preview_start` only ever manages a server defined in the current project's `.claude/launch.json` — there is no path from this skill to a real/production URL.

## 1. Ground yourself in the project

- Look for `.claude/launch.json`. If it doesn't exist, create it from `package.json`'s dev script, e.g.:
  ```json
  {
    "version": "0.0.1",
    "configurations": [
      { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
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
- Exercise the page's main interactive elements: open dialogs/panels, try key forms, and exercise CRUD where it's central to the page's purpose (creating, editing, deleting real records is fine — this only runs against a local dev server, and you don't need to clean up afterward).
- Do a quick accessibility pass over the snapshot: missing labels on inputs/buttons, missing alt text, elements that should be interactive but aren't exposed as such, obvious keyboard-nav dead ends.

Stop crawling once you hit the budget or run out of new reachable pages, whichever comes first.

## 6. Pin down locations as you go

The moment something looks wrong, resolve where it lives in the code before moving on — read the route file for the current page, or grep for text/labels you saw on screen. Every finding in the final report must name a real file, not "the settings page" with no path.

## 7. Stay inside the app

CRUD on the app's own data is fine. Never trigger something with a real external effect — don't submit a form that would send a real email, hit a real payment provider, or call a real third-party webhook, even if the button is right there.

## 8. Write the report

Save to `./review-notes/auto-review-YYYY-MM-DD-HHMM.md` (create the folder if needed):

```md
# Automated Review — <date/time>

Branch: <branch>
Scope: <how you interpreted the scope argument, or "full app">

## Coverage

- Pages/views visited: <count and list>
- Auth: <reached / not reached, and why>
- Budget: <hit the ~20-page cap / crawl frontier exhausted naturally>

## Goal

Address all action items below. Each item is self-contained: route, file paths, fix direction, and acceptance criteria are specified. Work through them in severity order. After each fix, verify against its acceptance criteria. Run typecheck, lint, and tests before considering an item done. Do not weaken tests to pass.

## Summary

<1–2 sentence overview + counts by type/severity>

## Action Items

### Blockers

- [ ] **<short title>**
  - **What:** <concrete description>
  - **Where:** `<route>` -> `<file path>` (`<component/function>`)
  - **Type:** bug | UX | accessibility | console-error | network-error | copy | idea
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
- If yes: tell the user to run `/compact` on this session first (you can't trigger that yourself), then hand the file to Claude Code's Goals feature with:

  > Fix everything in `./review-notes/auto-review-<date>-<time>.md`. Work through the action items in severity order. After each fix, verify it against that item's acceptance criteria. Run typecheck, lint, and tests before considering an item done — do not weaken tests to pass.

  Don't start fixing things yourself in this same turn — give the file path and directive so the user can start the Goal with a clean context.
````

- [ ] **Step 2: Verify the frontmatter is well-formed**

Run:
```bash
head -n 4 "/c/Users/ericj/.claude/skills/custom-review-app/SKILL.md"
```
Expected output (exactly):
```
---
name: custom-review-app
description: Autonomously drive the app through the Claude Preview browser tools, exercise it end-to-end, and produce a self-contained findings report — no human needs to browse. Use when asked to "review the app", "run an e2e review", "find bugs automatically", or "test what we just built" (including scoped requests like "test dark mode", "test mobile", or "test what we just did").
---
```

- [ ] **Step 3: Diff against a sibling skill to confirm structural consistency**

Run:
```bash
diff <(head -n 3 "/c/Users/ericj/.claude/skills/custom-review-session/SKILL.md") <(head -n 3 "/c/Users/ericj/.claude/skills/custom-review-app/SKILL.md")
```
Expected: only the `name:`/`description:` lines differ (both start with `---`, both have a `name:` line, both have a `description:` line, both close with `---`) — confirms the new file follows the same frontmatter shape as the existing global skill.

---

### Task 2: Dry-run the skill against this repo

There is no automated test suite for a skill written in natural language — the acceptance test is running it for real, against a real (but harmless) scope, and confirming the behavior matches the spec.

**Files:**
- None created/modified — this task exercises the skill via the `Skill` tool and the app it drives (this repo, `D:\Dev\roadmaps\...`).

- [ ] **Step 1: Confirm `.claude/launch.json` exists for this project, or note that it will be created**

Run:
```bash
cat .claude/launch.json 2>&1 || echo "MISSING"
```
Expected: either valid JSON with a `configurations` entry pointing at `npm run dev` on port `3000` (per `CLAUDE.md`: "Vite dev server on :3000"), or `MISSING` — if missing, the skill itself is responsible for creating it in the dry run, per step 1 of `SKILL.md`. Don't create it manually here; that would skip testing the skill's own bootstrap logic.

- [ ] **Step 2: Invoke the skill with a narrow, cheap scope**

Invoke it via the `Skill` tool with `skill: "custom-review-app"` and `args: "just the /dashboard page, unauthenticated is fine, do not attempt login"`. This deliberately narrows scope to a single, low-risk page so the dry run finishes quickly and doesn't require solving auth in this pass — Task 2 is checking *mechanics* (does it start the preview, gather context, produce a correctly-shaped report), not full coverage.

- [ ] **Step 3: Confirm the skill produced a report matching the spec's template**

Run:
```bash
ls review-notes/auto-review-*.md
```
Expected: one new file matching `review-notes/auto-review-YYYY-MM-DD-HHMM.md`.

Read the file and confirm it has: a `Branch:` line, a `Scope:` line, a `## Coverage` section, a `## Goal` section, a `## Summary` section, and a `## Action Items` section with severity subheadings (even if some are empty because the dashboard page had no findings — the structure must still be present).

- [ ] **Step 4: Confirm the skill asked the wrap-up question**

Confirm the skill's final message in the conversation asked "Want me to fix these now?" (or a clear paraphrase) rather than silently ending after writing the file, per step 9 of `SKILL.md`.

---

### Task 3: Fix anything the dry run surfaced

**Files:**
- Modify: `C:\Users\ericj\.claude\skills\custom-review-app\SKILL.md` (only if Task 2 surfaced a problem)

- [ ] **Step 1: If Task 2 passed with no issues, skip this task**

If the report in Task 2 matched the template, asked the wrap-up question, and no tool errors occurred, there is nothing to fix — mark this task done and move to Task 4.

- [ ] **Step 2: If something didn't match, edit the relevant section of `SKILL.md`**

Example failure modes and their fix location within the file:
- Report missing the `## Coverage` section → the model skipped step 8's template; re-check step 8's instructions are unambiguous about including it, tighten the wording if the model paraphrased it away.
- Skill tried to guess/invent login credentials → step 4's "do not guess or invent credentials" line needs to be more prominent (move it earlier in the sentence, or bold it).
- Skill exceeded the page budget or never stopped → step 5's stopping condition needs a harder trigger word (e.g. change "Stop crawling once..." to "You MUST stop crawling once...").

Whatever the actual failure was, make the smallest wording change in `SKILL.md` that would have prevented it — don't rewrite unrelated sections.

- [ ] **Step 3: Re-run Task 2's dry run to confirm the fix**

Re-invoke the skill the same way as Task 2 Step 2, and re-check Task 2 Steps 3–4 pass.

---

### Task 4: Clean up the dry-run artifact and close out

**Files:**
- Delete: `review-notes/auto-review-*.md` (the dry-run report from Task 2/3 — this is a real repo directory, not the global skills directory, so it must not be left behind as noise in the user's working tree)

- [ ] **Step 1: Remove the dry-run report**

Run:
```bash
rm review-notes/auto-review-*.md
```

- [ ] **Step 2: Confirm the working tree is clean**

Run:
```bash
git status --short
```
Expected: no output related to `review-notes/` (the directory itself may remain if `custom-review-session` already created it earlier; that's fine — only the dry-run file needed removing). Note: since the skill file lives at `C:\Users\ericj\.claude\skills\custom-review-app\SKILL.md`, which is outside this git repository, there is nothing to commit in *this* repo for Task 1–3's work — the skill is now live and usable in every project immediately, with no build/deploy step.

- [ ] **Step 3: Report completion to the user**

Tell the user the skill is live at `C:\Users\ericj\.claude\skills\custom-review-app\SKILL.md`, confirmed working via a dry run against this repo, and can be invoked as `/custom-review-app [scope]` in any project from now on.

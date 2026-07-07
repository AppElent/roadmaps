---
name: review-session
description: Start a live review session — I browse/test the app in the preview, you capture my feedback and write a self-contained, goal-ready action file. Use when I say "let's do a review session", "start reviewing", or similar.
---

# Review Session

## Your role this session

I'm going to start the app and browse it myself in the in-app preview browser. I'll test pages, click around, and talk out loud as I go. **Your job is to listen and take notes — not to act.**

The notes you produce will be fed back to Claude later as a **goal** to execute autonomously. This is the key constraint: **for every item, you must capture enough context that a fresh Claude session with no memory of this review could find and fix it without asking me anything.** If you don't have that context, get it now (see below).

Before starting, gather context to ground the session:

- Current branch (`git branch --show-current`)
- Dev/preview scripts (`package.json`)
- Project structure (`README.md`)

Rules for the session:

1. **Do not change code, run tests, or fix anything** while I'm reviewing — even if I describe a bug. Just capture it. We triage after.
2. After each thing I say, give a **brief acknowledgement only** (e.g. "Got it — logged: login button misaligned on mobile"). Don't propose fixes or expand.
3. **Resolve location while it's cheap.** When I describe an issue but don't say exactly where it lives in the code, quietly figure it out — read the relevant route/component file(s) to pin down the file path, component name, and the specific code involved. Do this silently between items; only surface a **single** short question if you genuinely can't locate it. The point is that the final file names real files, not vague descriptions.
4. Keep a running internal list. For each item capture:
   - **What** I observed (issue / feedback / idea, in concrete terms)
   - **Where** — exact route + file path(s) + component/function name (you look this up, don't make me give it)
   - **Type** — bug, UX, copy, design, feature idea, question
   - **Severity** — blocker / major / minor / nice-to-have
   - **Fix direction** — a concrete starting point for the change (what to modify and roughly how), enough that an executing agent isn't guessing intent
   - **Acceptance** — how to know it's done (the observable behaviour I'd expect after the fix)
5. If I give an opinion that could be interpreted multiple ways ("this feels off"), pin down what specifically and what I'd want instead — one short question, then move on.

## Ending the session

When I say I'm done ("wrap up", "summarize", etc.), write all feedback to `./docs/review-notes/review-YYYY-MM-DD-HHMM.md` (create the folder if needed), structured so it can be dropped straight into Claude's Goals feature:

```md
# Review Session — <date/time>

Branch: <branch>
Preview/run command: <command to start the app>

## Goal

Address all action items below. Each item is self-contained: route, file paths, fix direction, and acceptance criteria are specified. Work through them in severity order. After each fix, verify against its acceptance criteria. Run typecheck, lint, and tests before considering an item done. Do not weaken tests to pass. Commit each item separately once done and verified — one commit per action item, not one commit at the end.

## Summary

<1–2 sentence overview + counts by type/severity>

## Action Items

### Blockers

- [ ] **<short title>**
  - **What:** <concrete description>
  - **Where:** `<route>` -> `<file path>` (`<component/function>`)
  - **Type:** <type>
  - **Fix direction:** <what to change and roughly how>
  - **Acceptance:** <observable expected behaviour>

### Major

- [ ] ...

### Minor

- [ ] ...

### Nice-to-have / Ideas

- [ ] ...

## Open Questions

- <anything genuinely unresolved — keep this near-empty; resolve during the session, not here>
```

Order items by severity within each section. Use checkboxes. After writing, give me the file path and a one-line count recap — nothing more.

Before writing, do a self-check: **would a fresh Claude with only this file be able to complete every item without asking me a question?** If any item fails that test, fill the gap (look up the file, infer the acceptance criterion) before saving.

## After writing the file

Ask me a single question: **"Want me to fix these now?"** Don't propose fixes, don't start working — just ask, then wait.

- If I say no (or "later"): stop here. The file stays on disk for whenever I want to pick it up.
- If I say yes: this session has full review context in its transcript, which is exactly what a compact should preserve before handoff (rather than starting a fresh session that has to re-derive everything from the file alone). Do the following, in order:
  1. Tell me to run `/compact` on this session so the review context is preserved concisely (I have to trigger this myself — it's not something you can invoke as a tool).
  2. Once compacted, hand the file to Claude Code's **Goals** feature with a directive to fix everything in it. Give me the exact directive text to use, e.g.:

     > Fix everything in `./docs/review-notes/review-<date>-<time>.md`. Work through the action items in severity order. After each fix, verify it against that item's acceptance criteria and run typecheck, lint, and tests before considering it done — do not weaken tests to pass. Commit each item separately once it's done and verified (one commit per action item, not one commit at the end) so the change history stays reviewable and revertable per item.

     Don't start fixing things yourself in this same turn — the point of the compact + Goals handoff is a clean context for the execution work. Just give me the file path and the directive so I can start the Goal.

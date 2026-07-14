---
name: upgrade-deps
description: Upgrade this app's dependencies safely — check outdated packages, prioritize the TanStack ecosystem, verify typecheck/lint/tests/build, then commit. Use when asked to "upgrade dependencies", "update packages", "bump versions", or similar.
---

# upgrade-deps

Upgrade this app's dependencies safely. The package manager is **pnpm** —
use it consistently for every command below.

First, gather context: read `package.json` for the package manager and
scripts, and run `git branch --show-current` and `git status --short` for
the current branch and working-tree state.

1. **Check outdated packages** (`pnpm outdated`). Upgrade dependencies,
   prioritizing the TanStack ecosystem (`@tanstack/react-start`,
   `@tanstack/react-router`, `@tanstack/router-plugin`,
   `@tanstack/react-query`, etc.) and keeping them on compatible versions
   with each other. Apply minor/patch upgrades freely; for major version
   bumps, check release notes / breaking changes and only proceed if the
   migration is straightforward — otherwise list them for the user to
   decide.
2. **Install** the updated dependencies (`pnpm install`).
3. **Type-check** (`pnpm run typecheck`).
4. **Run lint/format check** (`pnpm run check`). Fix any new lint errors
   introduced by the upgrade.
5. **Run tests** (`pnpm test`). Fix any failures caused by the upgrade. Do
   NOT weaken or skip tests to make them pass.
6. **Build** to confirm the production build still works (`pnpm build`).
7. If any step fails and can't be fixed cleanly, **stop and report**
   rather than committing broken code.
8. Once typecheck, check, tests, and build all pass, **commit**:
   - Stage the dependency and lockfile changes plus any required code
     fixes.
   - Write a clear conventional commit message (e.g.
     `chore(deps): upgrade dependencies`) summarizing what was bumped.
   - Push to the current branch on GitHub.

Report a concise summary of what was upgraded and the final status of
each check.

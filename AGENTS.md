# AGENTS.md

Read `CLAUDE.md` for all project conventions (pnpm always, Biome, commands, testing).

## Upgrading dependencies

Follow the steps in `.claude/commands/upgrade-deps.md` (readable as plain markdown).
Never weaken or skip tests to make an upgrade pass; stop and report instead.

<!-- appelent-managed:start -->
## Appelent Managed Project

This is an Appelent-managed app. Opted-in features and their options are
recorded in `appelent.json`. Feature definitions live in the `appelent`
plugin (locally installed) or https://github.com/AppElent/appelent-packages
(`skills/<feature>/FEATURE.md`).

Before adding functionality that could apply to multiple apps, check the
feature catalog first. To add or update a feature, use `/appelent`.
<!-- appelent-managed:end -->

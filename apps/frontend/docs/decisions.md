# Decisions

Decisions taken on @twake-space/frontend, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-24, [Tech] Rslint lints and rs fmt formats, from the root rstack.config.mjs

- Decision: both workspaces lint with `rs lint` and format with `rs fmt` (rstack), reading the root `rstack.config.mjs` through `--config`, as twake-tasks does; ESLint and Prettier are gone, and the rules ESLint ran stay on, the React Compiler, TanStack Query and Vitest ones through their ESLint plugins.
- Decided by: agent, asked by Théo, to be confirmed by the maintainer.
- Why: the frontend lint drops from 18 s to 4 s and the backend one from 8.5 s to 1 s, with the same rules.
- Scope: both; the frontend and @twake-space/backend.

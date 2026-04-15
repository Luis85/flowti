# Agentonomous

Autonomous agents sandbox — an Obsidian plugin scaffolded as a Vue 3 + DDD infrastructure skeleton. First increment ships the target architecture and build harness with no business logic.

## Status

`0.0.1` — infrastructure skeleton only. No autonomous-agent features yet.

## Install (development)

Requires Node `>=20.19.0`.

    cd "01 - Projects/Agentonomous"
    npm install
    npm run build

`npm run build` emits `dist/main.js`, `dist/manifest.json`, `dist/styles.css` and auto-deploys them to the test vault resolved from `AGENTONOMOUS_TEST_VAULT` (default `C:\Projects\Agentonomous`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Production build + deploy to test vault |
| `npm run build:dev` | Watch build + deploy on each change |
| `npm test` | Lint + typecheck + Vitest |
| `npm run test:watch` | Vitest watch mode |
| `npm run storybook` | Storybook 10 dev server on `:6006` |
| `npm run docs` | Generate TypeDoc API docs in `docs/api/` |
| `npm run release` | Produce `dist/agentonomous-<version>.zip` |

## Architecture

Three layers enforced by ESLint:

- `src/domain/` — plain TypeScript. No Vue, no Obsidian, no `node:*`.
- `src/infrastructure/` — Obsidian adapters + platform I/O.
- `src/ui/` — Vue 3 + Pinia presentation. Consumes domain through ports and stores.

See `docs/specs/2026-04-15-agentonomous-skeleton-design.md`.

## License

MIT

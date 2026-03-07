---
type: CLIReference
date: "2026-03-07T20:37:01.368Z"
sections: 0
cli_commands: 25
npm_scripts: 38
report_generators: 14
---

# Flowti CLI Reference

> [!info] Summary
> CLI commands: 25 | Help sections: 0 | npm scripts: 38 | Report generators: 14

---

## Quick Start

```bash
npm run flowti              # Interactive menu
npm run flowti -- build     # Non-interactive: fast build
npm run flowti -- help      # Show full help
npm run flowti -- info      # Project stats
```

## Non-Interactive Commands

All commands can be run directly without the interactive menu:

| Command | Description |
|---|---|
| `npm run flowti -- help` | Show help (optionally for a section) |
| `npm run flowti -- build` | Fast build (esbuild only, no reports) |
| `npm run flowti -- build:increment` | Full CI pipeline: check → build → test → e2e → docs → distribute |
| `npm run flowti -- build:full` | Flow tests → build → all reports |
| `npm run flowti -- build:watch` | Watch mode with hot-reload (add --reload) |
| `npm run flowti -- build:distribute` | Build + distribute to endpoints |
| `npm run flowti -- test` | Type check + lint + vitest |
| `npm run flowti -- test:increment` | Check + build + vitest with coverage |
| `npm run flowti -- test:e2e` | Build + flow tests + E2E suite |
| `npm run flowti -- review` | List E2E journeys (interactive session) |
| `npm run flowti -- publish` | Build release pipeline |
| `npm run flowti -- publish:all` | Increment → E2E → release (stops on failure) |
| `npm run flowti -- reports` | Generate all report notes |
| `npm run flowti -- reports:audit` | Generate reports for audit review |
| `npm run flowti -- report:{id}` | Generate a single report by ID (e.g. report:test) |
| `npm run flowti -- dev:reload` | Reload plugin in Obsidian via CLI |
| `npm run flowti -- dev:console` | Open Obsidian developer console stream |
| `npm run flowti -- dev:errors` | Open Obsidian error stream |
| `npm run flowti -- dev:check` | Run lint + tsc (no tests) |
| `npm run flowti -- dev:lint` | Run ESLint on src/ |
| `npm run flowti -- dev:fix-frontmatter` | Fix missing frontmatter fields (add --dry-run) |
| `npm run flowti -- dev:testdata` | Generate CSV test data for Analytics |
| `npm run flowti -- make:hub` | Scaffold a new hub (--name required, --icon, --type, --tabs) |
| `npm run flowti -- make:plugin` | Scaffold a new plugin (--name required, --id, --author) |
| `npm run flowti -- info` | Show project stats, version, config |

## npm Scripts

| Script | Command |
|---|---|
| `test` | `npm run check && vitest run` |
| `test:watch` | `npm run check && vitest` |
| `test:ui` | `npm run check && vitest --ui` |
| `test:coverage` | `npm run check && npm run build:only && vitest run --coverage` |
| `test:flows` | `npm run build:only && vitest run tests/flows/ --coverage` |
| `test:e2e` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs` |
| `test:e2e:installer` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=installer` |
| `test:e2e:getting-started` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=getting-started` |
| `test:e2e:components` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=component-library` |
| `test:e2e:canvas-session` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=canvas-session` |
| `test:e2e:tool-showcase` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=tool-showcase` |
| `test:e2e:tool-reference` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=tool-reference` |
| `test:e2e:journey-builder` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=journey-builder` |
| `test:e2e:developer-onboarding` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=developer-onboarding` |
| `test:e2e:journeys` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=getting-started,component-library,canvas-session,tool-showcase,tool-reference,journey-builder,developer-onboarding` |
| `test:e2e:quick` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=installer,getting-started` |
| `test:e2e:list` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --list` |
| `review` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --list` |
| `report:e2e` | `node scripts/generate-e2e-report.mjs` |
| `build` | `node esbuild.config.mjs --production --no-reports` |
| `build:only` | `node esbuild.config.mjs --production --no-reports` |
| `build:dev` | `node esbuild.config.mjs --watch` |
| `build:full` | `npm run test:flows && node esbuild.config.mjs --production` |
| `dev:reload` | `node scripts/cli-reload.mjs` |
| `dev:console` | `obsidian dev:console` |
| `dev:errors` | `obsidian dev:errors` |
| `build:release` | `npm run check && npm run build:only && vitest run --coverage && npm run docs && node esbuild.config.mjs --publish` |
| `build:increment` | `npm run check && npm run build:only && vitest run --coverage && node scripts/run-e2e.mjs && npm run docs && node esbuild.config.mjs --increment --distribution` |
| `build:distribution` | `npm run check && npm run build:only && vitest run --coverage && npm run docs && node esbuild.config.mjs --distribution` |
| `check` | `npm run lint && tsc -noEmit -skipLibCheck` |
| `lint` | `eslint ./src/` |
| `docs` | `typedoc` |
| `test:increment` | `npm run check && npm run build:only && vitest run --coverage` |
| `reports` | `npm run generate:reports` |
| `flowti` | `node "../../01 - Projects/Flowti CLI/bin/src/main.js"` |
| `generate:testdata` | `node scripts/generate-test-data.mjs` |
| `generate:reports` | `node scripts/generate-test-report.mjs && node scripts/generate-coverage-report.mjs && node scripts/generate-codebase-report.mjs && node scripts/generate-cycle-report.mjs && node scripts/generate-trace-report.mjs && node scripts/generate-command-reference.mjs && node scripts/generate-event-catalog.mjs && node scripts/generate-data-dictionary.mjs && node scripts/generate-performance-report.mjs && node scripts/generate-complexity-report.mjs && node scripts/generate-tool-reference.mjs && node scripts/generate-cli-reference.mjs` |
| `version` | `node version-bump.mjs && git add manifest.json versions.json` |

## Report Generators

14 report generators are configured in `flowti.config.json`:

| ID | Label | Script |
|---|---|---|
| test | Test Report | `generate-test-report.mjs` |
| coverage | Coverage Report | `generate-coverage-report.mjs` |
| build | Build Report | `generate-build-report.mjs` |
| codebase | Codebase Report | `generate-codebase-report.mjs` |
| cycle | Cycle Report | `generate-cycle-report.mjs` |
| trace | Trace Report | `generate-trace-report.mjs` |
| command-ref | Command Reference | `generate-command-reference.mjs` |
| event-catalog | Event Catalog | `generate-event-catalog.mjs` |
| dictionary | Data Dictionary | `generate-data-dictionary.mjs` |
| performance | Performance Report | `generate-performance-report.mjs` |
| complexity | Complexity Report | `generate-complexity-report.mjs` |
| tool-ref | Tool Reference | `generate-tool-reference.mjs` |
| e2e | E2E Report | `generate-e2e-report.mjs` |
| cli-ref | CLI Reference | `generate-cli-reference.mjs` |

## Make Configuration

Scaffold output paths (`flowti.config.json` → `make`):

### Hub Paths

| Key | Path |
|---|---|
| `make.hub.src` | `src` |
| `make.hub.ui` | `src/ui` |
| `make.hub.domain` | `src/domain` |
| `make.hub.hubDomain` | `src/domain/hub` |
| `make.hub.tests` | `tests/ui` |
| `make.hub.css` | `css` |
| `make.hub.docs` | `docs/features` |
| `make.hub.journeys` | `tests/e2e/journeys` |
| `make.hub.components` | `src/ui/components` |

### Plugin Paths

| Key | Path |
|---|---|
| `make.plugin.output` | `../` |

## Configuration Files

| File | Purpose |
|---|---|
| `flowti.config.json` | CLI config: paths, build settings, report scripts, make paths |
| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |
| `manifest.json` | Obsidian plugin metadata (id, version, author) |
| `package.json` | npm scripts, dependencies |

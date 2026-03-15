# Vault Test Environment — Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Author:** Tess (Tester Agent) + Human
**Scope:** Flowti CLI

## Problem

All CLI testing currently happens inside the development vault. There is no way to validate the compiled CLI binary as an end user would experience it — booting in standalone mode, discovering projects, running commands against real project structures. This gap means regressions in the build/bootstrap pipeline, CLI output formatting, and project discovery logic go undetected until manual testing.

## Goal

Build a dedicated, portable test environment that validates the Flowti CLI independently from the development vault. The environment must be:

- **Easily deployable** — a single command provisions a clean test vault
- **Easily portable** — runs locally, in CI, and via agent orchestration
- **Traceable** — test scenarios are readable journey definitions, results flow into the Flowti ecosystem
- **Layered** — three tiers (smoke, integration, ecosystem) that build progressively

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | All three tiers, layered | Quick wins at Tier 1, growth path to Tier 3 |
| Vault structure | Hybrid (template + ephemeral copy) | Reproducible fixtures + isolation per run |
| Execution targets | Local → CI → Agent-driven | Progressive enablement |
| Sample projects | Two contrasting (healthy + broken) | Best coverage-to-complexity ratio |
| Assertion strategy | Mixed by tier | Exit codes → JSON → combined with reports |
| Test runner | Vitest harness + journey spec format | Unified toolchain, journeys as universal test language |
| Implementation priority | Foundation first | Architecture that lets tiers stack cleanly |

## Architecture Overview

```
tests/vault-template/          ← Version-controlled fixture vault
    ↓ (copied to temp dir)
vault-test-provider.setup()    ← Provisions ephemeral vault, injects CLI binary
    ↓
Journey Definitions            ← .journey files organized by tier
    ↓ (loaded by journey-loader)
Journey Executor               ← Runs steps using vault-cli/vault-project/vault-assert tools
    ↓ (wrapped by)
Vitest Harness                 ← configs/vitest.vault.config.ts, tier runner .test.ts files
    ↓ (reports to)
Reports + World-State          ← vault-testreport.json/md, activity log
    ↓ (consumed by)
Tess / CI / Human              ← Agent briefs, GitHub Actions, npm scripts
```

## Section 1: Template Vault

A version-controlled fixture vault that serves as the source for ephemeral test copies.

**Location:** `tests/vault-template/`

```
tests/vault-template/
├── .flowti/
│   ├── config.json                  # Standalone mode (no source path)
│   ├── bin/                         # Empty — CLI binary injected at setup
│   └── ai-tools/                    # Minimal tool defs for Tier 3
├── 01 - Projects/
│   ├── Healthy App/
│   │   ├── package.json             # Real scripts (build, test, lint, check)
│   │   ├── configs/
│   │   │   └── flowti.config.json   # Valid config with passing thresholds
│   │   ├── src/
│   │   │   └── main.ts              # Minimal compilable TypeScript
│   │   └── tests/
│   │       └── main.test.ts         # Passing tests
│   └── Broken App/
│       ├── package.json             # Scripts that fail or produce degraded output
│       ├── configs/
│       │   └── flowti.config.json   # Config with impossible thresholds
│       ├── src/
│       │   └── main.ts              # Type errors, lint violations
│       └── tests/
│           └── main.test.ts         # Failing tests
└── flowti.cmd                       # Windows launcher
```

### Design Rules

- The vault runs in **standalone mode** — `.flowti/config.json` has no `source` field, so bootstrap skips build/npm and runs the pre-built binary directly.
- The CLI binary (`.flowti/bin/main.js`) is **never checked into the template** — it is injected by the provider's `setup()` from the freshly-built output.
- Both sample projects use real `package.json` with actual devDependencies (vitest, typescript, eslint) so commands execute genuinely.
- `node_modules/` strategy: On first run, `npm ci` installs into each sample project. The resulting `node_modules/` directories are **copied** (not symlinked) into each ephemeral vault. Symlinks are avoided because Windows requires elevated privileges or Developer Mode for directory symlinks. In CI, GitHub Actions cache on `package-lock.json` hash avoids repeated installs.

### Healthy App

A minimal TypeScript project that passes all checks:
- `npm run build` succeeds (esbuild produces output)
- `npm test` passes (vitest runs, all green)
- `npm run lint` passes (eslint clean)
- `npm run check` passes (tsc + eslint)
- Health score above configured thresholds
- Valid `flowti.config.json` with build commands, test presets, health thresholds

### Broken App

A deliberately degraded project that exercises error paths:
- `npm run build` fails (TypeScript errors prevent compilation)
- `npm test` fails (test assertions fail)
- `npm run lint` fails (lint violations present)
- Health score below configured thresholds
- `flowti.config.json` with impossibly strict thresholds (100% coverage, 0 lint errors on broken code)

## Section 2: Vault-Test Provider

A new `EnvironmentProvider` registered alongside the existing 5 providers.

**File:** `src/domain/e2e/journey/providers/vault-test-provider.ts`

### Provider Definition

```typescript
target: "vault-test"
label: "Vault Test"
capabilities: ["command", "filesystem", "vault-provision", "vault-cli", "vault-project"]
```

### setup(deps, opts)

1. Guard: `opts.variables ??= {}` (the variables map may be undefined at call time)
2. Copy `tests/vault-template/` → `os.tmpdir()/flowti-vault-test-{uuid}`
3. Inject freshly-built CLI binary from `.flowti/bin/main.js` into the copy's `.flowti/bin/`
4. Copy `node_modules/` into both sample projects (from template if pre-installed, otherwise run `npm ci`)
5. Set `opts.variables`:
   - `vaultRoot` → temp vault path
   - `healthyProject` → `"Healthy App"` (resolved path)
   - `brokenProject` → `"Broken App"` (resolved path)
6. Log provisioning summary

**Note:** `setup()` is called once per journey (not once per tier). Each journey gets its own fresh vault copy. See Section 5 for the runner's `beforeEach`/`afterEach` lifecycle.

### teardown(deps)

1. Remove temp vault directory (unless `opts.variables["keepVault"] === "true"` for debugging)
2. Log cleanup summary

### Registration

Added to `providers/index.ts`:
```typescript
registry.registerProvider(createVaultTestProvider());
```

Journey files declare `requires: { target: "vault-test" }` to activate this provider.

## Section 3: Vault-Specific Tools

Three tools extending the base 9 (command, assert, wait, log, file-write, file-read, file-exists, frontmatter, screenshot).

### vault-cli

Executes Flowti CLI commands against the provisioned vault.

| Property | Type | Required | Description |
|---|---|---|---|
| `command` | string | yes | CLI command and flags (e.g. `"build --project=\"Healthy App\""`) |
| `expectExit` | number | no | Expected exit code (default: 0) |
| `stdoutContains` | string | no | Substring match on stdout |
| `storeAs` | string | no | Store stdout in variables for downstream steps |
| `format` | string | no | If `"json"`, auto-parse stdout and store parsed object |

**Resolution:** `node {{vaultRoot}}/.flowti/bin/main.js <command>` with `cwd` resolved from `opts.variables["vaultRoot"]`, **not** from `opts.cwd`. This ensures commands always run in the provisioned vault regardless of the tier runner's working directory. The tool explicitly passes `{ cwd: opts.variables!["vaultRoot"] }` to `deps.exec()`.

**Examples:**
```json
{ "tool": "vault-cli", "command": "help", "expectExit": 0, "stdoutContains": "flowti" }
{ "tool": "vault-cli", "command": "health --project=\"Healthy App\" --format=json", "format": "json", "storeAs": "healthResult" }
```

### vault-project

Project-aware convenience wrapper around vault-cli.

| Property | Type | Required | Description |
|---|---|---|---|
| `op` | string | yes | Operation: `"list"`, `"info"`, `"run"` |
| `project` | string | for info/run | Project name |
| `command` | string | for run | CLI command to execute |
| `expectExit` | number | no | Expected exit code |
| `storeAs` | string | no | Store output in variables |

**Operations:**
- `list` → Reads the vault's `01 - Projects/` directory and returns project folder names. Does not rely on a CLI command (project listing is a filesystem operation, not a CLI endpoint). If a `flowti projects:list` command is added in the future, this tool can delegate to it.
- `info` → `flowti info --project="X" --format=json`
- `run` → `flowti <command> --project="X"`

### vault-assert

Vault-aware assertions for integration and ecosystem tiers.

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Assertion type (see below) |
| `project` | string | varies | Target project name |
| `source` | string | for json-field, health-score | Variable name from prior `storeAs` |
| `field` | string | for json-field | Dot-path into JSON object |
| `operator` | string | for json-field | `eq`, `gt`, `gte`, `lt`, `lte`, `contains` |
| `expected` | any | for json-field | Expected value |
| `min` / `max` | number | for health-score | Score range |
| `report` | string | for report-exists | Report type name |
| `name` | string | for stdout-snapshot | Snapshot identifier |
| `actual` | string | for stdout-snapshot | Value to compare |

**Assertion types:**
- `health-score` — Reads from a stored JSON variable (populated by a prior `vault-cli` step with `storeAs`), extracts the `score` field, checks it falls within `min`/`max` range. Requires `source` property pointing to the variable name. Does **not** re-execute the CLI.
- `report-exists` — Checks file existence in project's reports directory
- `json-field` — Reads from stored variable, traverses dot-path, applies operator
- `stdout-snapshot` — Compares against snapshot file in `tests/vault-journeys/__snapshots__/`

### File Organization

All three tools implemented in `vault-test-provider.ts` (estimated ~250 lines). If it exceeds the 350-line lint threshold, tools extract to `vault-test-tools.ts` following the obsidian-plugin pattern.

## Section 4: Journey Definitions by Tier

Journey files organized by tier. Each is a `.journey` JSON file loaded by the existing journey loader.

**Location:** `tests/vault-journeys/`

```
tests/vault-journeys/
├── tier-1-smoke/
│   ├── boot.journey              # CLI boots and shows version
│   ├── help.journey              # Help command lists available commands
│   └── project-discovery.journey # CLI discovers both sample projects
├── tier-2-integration/
│   ├── build-healthy.journey     # Build succeeds on Healthy App
│   ├── build-broken.journey      # Build fails on Broken App (expected)
│   ├── test-healthy.journey      # Tests pass on Healthy App
│   ├── test-broken.journey       # Tests fail on Broken App (expected)
│   ├── health-healthy.journey    # Health score above threshold
│   ├── health-broken.journey     # Health score below threshold
│   ├── reports.journey           # Report generation and file output
│   └── scaffold.journey          # Scaffold new project, verify structure
├── tier-3-ecosystem/
│   ├── world-state.journey       # World state loads, shows agents
│   ├── agent-status.journey      # Agent status for individual agents
│   ├── iteration-lifecycle.journey # Create/advance iteration phases
│   └── claude-sync.journey       # claude:sync generates skill files
└── __snapshots__/                # Snapshot files for stdout-snapshot assertions
```

### Tier 1 — Smoke (3 journeys, ~5s)

**Purpose:** Verify the compiled binary boots and responds. Gate for higher tiers.

**Assertion style:** Exit codes only.

| Journey | Steps | What it validates |
|---|---|---|
| boot | 1 | CLI binary starts, outputs version info |
| help | 2 | Help lists commands, exit code 0 |
| project-discovery | 2 | CLI finds both sample projects by name |

### Tier 2 — Integration (8 journeys, ~30s)

**Purpose:** Exercise core CLI commands against both sample projects with structured output validation.

**Assertion style:** JSON field assertions on `--format=json` output.

| Journey | Steps | What it validates |
|---|---|---|
| build-healthy | 2 | Build succeeds, output file exists |
| build-broken | 2 | Build fails gracefully, meaningful error output |
| test-healthy | 2 | Tests pass, JSON shows pass count > 0 |
| test-broken | 2 | Tests fail, JSON shows failure count > 0 |
| health-healthy | 3 | Health score in range, report generated |
| health-broken | 3 | Health score below threshold, degraded status |
| reports | 3 | Report generation, file output, valid format |
| scaffold | 4 | Scaffold new project inside vault, verify structure, build it |

### Tier 3 — Ecosystem (4 journeys, ~60s)

**Purpose:** Validate agent orchestration, iteration lifecycle, and ecosystem integration.

**Assertion style:** Combined exit codes + JSON + state assertions.

| Journey | Steps | What it validates |
|---|---|---|
| world-state | 3 | State command outputs JSON, contains agents, valid structure |
| agent-status | 3 | Individual agent lookup, persona/skills present |
| iteration-lifecycle | 5 | Create iteration, advance phases, verify state transitions |
| claude-sync | 3 | Sync generates skill files, content matches agent roster |

### Journey Design Rules

- Each journey is **self-contained** — no cross-journey dependencies. Every journey gets its own fresh vault copy via `setup()`/`teardown()` at the `describe()` level (see Section 5). This means `scaffold.journey` creating new files does not affect other journeys.
- `$ref` composition is available but not used initially (YAGNI). Extract shared steps only when repetition becomes painful.
- Journey names map 1:1 to Vitest test names for traceability.
- Negative tests (broken app) explicitly declare expected non-zero exit codes.
- Mutation journeys (e.g. `scaffold.journey`) are safe because of per-journey isolation — no ordering constraints needed.

## Section 5: Vitest Harness

A dedicated Vitest configuration for vault journey tests, separate from the 6,691 unit tests.

**Config file:** `configs/vitest.vault.config.ts`

### Configuration

| Setting | Value | Rationale |
|---|---|---|
| Pool | `forks` | Process isolation per journey (matches unit config) |
| Include | `tests/vault-journeys/**/*.test.ts` | Only vault runners, not the 6,691 unit tests |
| Timeout | 60,000ms | Vault operations are slower than unit tests |
| Globals | `true` | Consistent with unit test config |
| Restore/clear mocks | `true` | Clean state between runs |
| Reporters | default + JSON | Console for humans, JSON for agents/CI |
| JSON output | `reports/tests/vault-testreport.json` | Standard reports location |
| Coverage | disabled | Tests the binary, not source instrumentation |

### Test Pattern

`tests/vault-journeys/**/*.test.ts` — one test file per tier.

### Tier Runner Files

Three runner files bridge Vitest and the journey executor:

```
tests/vault-journeys/
├── tier-1-smoke.test.ts
├── tier-2-integration.test.ts
└── tier-3-ecosystem.test.ts
```

Each runner:
1. Loads all `.journey` files from its tier directory via `loadAllJourneys(readFile, listFiles, dir)` — using `node:fs` directly (permitted in test files per architecture rules)
2. Creates a `describe()` block per journey
3. Provider `setup()` runs in `beforeEach()` inside the `describe()` — **each journey gets its own fresh vault copy**
4. Creates an `it()` per step within each journey, calling `runStep()` from the existing journey test runner
5. Provider `teardown()` runs in `afterEach()` — cleans up the ephemeral vault

**Tier runner skeleton:**
```typescript
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadAllJourneys } from "../../src/domain/e2e/journey/journey-loader.js";
import { runStep, setToolDeps, createDefaultDeps, resolveJourneyEnvironment } from "../../src/domain/e2e/journey/journey-test-runner.js";
import { createVaultTestProvider } from "../../src/domain/e2e/journey/providers/vault-test-provider.js";
import { createDefaultRegistry } from "../../src/domain/e2e/journey/providers/index.js";
import { createDefaultDeps as createInfraDeps } from "../../src/infrastructure/deps.js";

const readFile = (p: string) => readFileSync(p, "utf-8");
const listFiles = (d: string) => readdirSync(d).filter(f => f.endsWith(".journey"));
const journeysDir = join(import.meta.dirname, "tier-1-smoke");
const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
const provider = createVaultTestProvider();
const infraDeps = createInfraDeps();

for (const journey of journeys) {
  describe(`[Tier 1] ${journey.journey}`, () => {
    let opts: JourneyExecutorOptions;
    let env: ResolvedEnvironment;

    beforeEach(async () => {
      opts = { variables: {} };
      const deps = createDefaultDeps(infraDeps);
      env = resolveJourneyEnvironment(journey, createDefaultRegistry());
      await provider.setup!(deps, opts);
      setToolDeps(deps);
    });

    for (const step of journey.steps) {
      it(step.title, async () => {
        const result = await runStep(step, opts, env);
        expect(result.status).toBe("pass");
      });
    }

    afterEach(async () => {
      const deps = createDefaultDeps(infraDeps);
      await provider.teardown!(deps);
    });
  });
}
```

**Key implementation notes:**
- `createInfraDeps()` provides the real `CliDeps` (filesystem, shell, paths, clock) needed by `createDefaultDeps()`
- `resolveJourneyEnvironment()` looks up the `vault-test` provider and returns the `ResolvedEnvironment` with merged tools (base + vault-specific)
- `env` is passed to `runStep()` so that `vault-cli`, `vault-project`, and `vault-assert` tools are available — without it, only base tools execute and vault-specific steps silently skip
- `import.meta.dirname` provides an absolute path, avoiding CI fragility from relative paths

### npm Scripts

Added to `package.json`:

```json
{
  "test:vault": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts",
  "test:vault:smoke": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-1-smoke.test.ts",
  "test:vault:integration": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-2-integration.test.ts",
  "test:vault:ecosystem": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts"
}
```

All scripts build the CLI binary first (explicit, matches existing `test` script pattern).

## Section 6: Tess Integration & Reporting

Three integration layers, progressively enabled.

### Layer 1: CLI Commands (immediate)

New non-interactive commands:

```bash
flowti test:vault                                          # All tiers
flowti test:vault --tier=smoke                             # Specific tier
flowti test:vault --tier=integration --project="Healthy App"  # Filtered
flowti test:vault --format=json                            # Structured output
```

The `vault-test.controller.ts` is registered independently in the command registry (in `main.ts`), analogous to how `state.controller.ts` is separate from `build.controller.ts`. The `test:vault` namespace does not conflict with the existing `test` and `test:*` commands in `build.controller.ts`.

Controller wraps results in `CliResponse<VaultTestResult>`:

```typescript
interface VaultTestResult {
  tier: string;
  journeys: number;
  steps: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: { journey: string; step: string; error: string }[];
}
```

### Layer 2: World-State Integration (short-term)

Vault test runs log to the activity log in `.flowti/var/world-state.json`:

```json
{
  "event": "vault-test-completed",
  "agent": "Tester",
  "tier": "integration",
  "passed": 12,
  "failed": 1,
  "timestamp": "2026-03-20T10:15:00Z"
}
```

Visible to all agents via `flowti state` and `world-state` tool output.

**Integration:** The existing `IWorldStateManager` already exposes `emitAction(action: AgentAction)`. The vault-test controller uses this directly: `req.deps.worldState.emitAction({ type: "vault-test-completed", agent: "Tester", ... })`. No new interface methods are needed.

### Layer 3: Brief-Driven Orchestration (future)

When Tess receives an `in-review` phase brief:
1. Brief includes "Run vault test suite against current build"
2. Tess executes `flowti test:vault --format=json`
3. Results feed into iteration deliverables
4. Failed journeys become defect items

No new infrastructure required — Tess uses the CLI command from Layer 1 within the existing brief/task system.

### Report Output

```
reports/
├── tests/
│   ├── vault-testreport.json    # Raw Vitest JSON (all tiers)
│   └── vault-testreport.md      # Human-readable summary
```

Markdown report includes: tier breakdown, pass/fail counts, failure details with journey/step traceability, duration.

## Section 7: CI Pipeline

**File:** `.github/workflows/vault-test.yml`

### Triggers

```yaml
on:
  push:
    branches: [master]
    paths:
      - "01 - Projects/Flowti CLI/src/**"
      - "01 - Projects/Flowti CLI/tests/vault-template/**"
      - "01 - Projects/Flowti CLI/tests/vault-journeys/**"
  pull_request:
    branches: [master]
  workflow_dispatch:    # Manual trigger for agent-driven runs
```

### Pipeline Steps

1. Checkout repo
2. Setup Node 22
3. Install CLI dependencies (`npm ci` in CLI project)
4. Build CLI binary (`node configs/esbuild.config.mjs`)
5. Run unit tests (`npx vitest run --config configs/vitest.config.ts`)
6. Install template vault dependencies (`npm ci` in both sample projects)
7. **Tier 1 — Smoke** (~5s, gates further tiers)
8. **Tier 2 — Integration** (~30s, gates Tier 3)
9. **Tier 3 — Ecosystem** (~60s)
10. Upload `vault-testreport.json` as artifact
11. Post `vault-testreport.md` as PR comment (on pull_request)

### Design Rules

- **Tiers run sequentially** — Tier 1 gates Tier 2, which gates Tier 3. If smoke fails, no point running integration.
- **Unit tests run first** — If source is broken, skip vault tests entirely.
- **Template vault `node_modules` cached** — GitHub Actions cache on `tests/vault-template/**/package-lock.json` hash.
- **`workflow_dispatch`** — Enables Tess or a human to trigger vault tests independently of code changes.

### Not Included (YAGNI)

- Matrix builds (multiple Node versions) — single target (Node 22)
- Parallel tier execution — sequential gating is safer
- Deployment gates — vault tests inform, don't block

## File Inventory

| File | Type | Purpose |
|---|---|---|
| `tests/vault-template/` | Fixture | Version-controlled template vault |
| `tests/vault-template/.flowti/config.json` | Config | Standalone mode vault config |
| `tests/vault-template/01 - Projects/Healthy App/` | Fixture | Passing sample project |
| `tests/vault-template/01 - Projects/Broken App/` | Fixture | Failing sample project |
| `src/domain/e2e/journey/providers/vault-test-provider.ts` | Source | EnvironmentProvider + 3 tools |
| `src/domain/e2e/journey/providers/index.ts` | Source | Register vault-test provider + 3 new capabilities (modify) |
| `src/domain/e2e/journey/journey-types.ts` | Source | Add `"vault-test"` to `ProjectTarget` union (modify) |
| `tests/vault-journeys/tier-1-smoke/*.journey` | Journey | 3 smoke test journeys |
| `tests/vault-journeys/tier-2-integration/*.journey` | Journey | 8 integration test journeys |
| `tests/vault-journeys/tier-3-ecosystem/*.journey` | Journey | 4 ecosystem test journeys |
| `tests/vault-journeys/tier-1-smoke.test.ts` | Test | Tier 1 Vitest runner |
| `tests/vault-journeys/tier-2-integration.test.ts` | Test | Tier 2 Vitest runner |
| `tests/vault-journeys/tier-3-ecosystem.test.ts` | Test | Tier 3 Vitest runner |
| `configs/vitest.vault.config.ts` | Config | Vault test Vitest config |
| `src/controller/vault-test.controller.ts` | Source | `flowti test:vault` command |
| `src/main.ts` | Source | Register vault-test controller (modify) |
| `.github/workflows/vault-test.yml` | CI | GitHub Actions pipeline |
| `package.json` | Config | New `test:vault*` scripts (modify) |

### Type System Changes

**`journey-types.ts`:** Add `"vault-test"` to the `ProjectTarget` union type:
```typescript
export type ProjectTarget = "cli" | "obsidian-vault" | "obsidian-plugin" | "typescript" | "webapp" | "vault-test";
```

### Capability Registrations

**`providers/index.ts`:** Register 3 new capabilities alongside the existing 16:
```typescript
registry.registerCapability({ id: "vault-provision", name: "Vault Provisioning", description: "Provision ephemeral test vaults", check: () => true });
registry.registerCapability({ id: "vault-cli", name: "Vault CLI Execution", description: "Execute Flowti CLI in provisioned vault", check: () => true });
registry.registerCapability({ id: "vault-project", name: "Vault Project Operations", description: "Query and manage projects in provisioned vault", check: () => true });
```

## Complete Journey Example

`tier-2-integration/health-healthy.journey`:
```json
{
  "journey": "Health Check — Healthy App",
  "description": "Verify health scoring on a well-configured project",
  "requires": { "target": "vault-test" },
  "steps": [
    {
      "id": "health-json",
      "title": "Health returns structured JSON",
      "description": "Run the health command with JSON output and store the result for subsequent assertions",
      "actions": [
        {
          "tool": "vault-cli",
          "command": "health --project=\"Healthy App\" --format=json",
          "expectExit": 0,
          "format": "json",
          "storeAs": "healthResult"
        }
      ]
    },
    {
      "id": "score-range",
      "title": "Health score is above minimum threshold",
      "description": "Verify the health score from the stored result falls within the acceptable range",
      "actions": [
        {
          "tool": "vault-assert",
          "type": "health-score",
          "source": "healthResult",
          "min": 70,
          "max": 100
        }
      ]
    },
    {
      "id": "report-generated",
      "title": "Health report file exists",
      "description": "Verify that running the health command produced a report file in the project's reports directory",
      "actions": [
        {
          "tool": "vault-assert",
          "type": "report-exists",
          "project": "Healthy App",
          "report": "health"
        }
      ]
    }
  ]
}
```

## Known Constraints

1. **Build failure before vault tests:** The `test:vault` npm scripts chain `node configs/esbuild.config.mjs && vitest run ...`. If the build fails, the `&&` operator prevents Vitest from running. This is intentional — vault tests against a stale binary are meaningless. The CI pipeline has an explicit build step before vault tests for the same reason.

2. **Stale temp directories from crashed runs:** If a previous run crashes before `teardown()`, orphaned `flowti-vault-test-*` directories may remain in `os.tmpdir()`. The provider's `setup()` does not clean up previous runs' directories. Mitigation: periodic manual cleanup, or add an optional `--clean` flag to the `test:vault` command that removes stale temp dirs before running.

3. **Tier 3 timeout budget:** The `iteration-lifecycle.journey` has 5 steps with a global 60s estimate for the entire tier. If iteration commands involve file I/O and state writes, individual steps may take 5-10s. The Vitest per-test timeout of 60s applies per `it()` block (per step), not per tier, so this is safe. The 60s tier estimate is for total wall time, not a hard limit.

4. **GitHub Actions path filters with spaces:** The CI trigger paths include `"01 - Projects/Flowti CLI/src/**"` which contains spaces. GitHub Actions handles quoted paths with spaces correctly, but this is verified behavior — do not remove the quotes.

5. **Windows-specific concerns:** The template vault uses `node_modules/` copy (not symlink) to avoid Windows permission issues. The `flowti.cmd` launcher is Windows-specific; Linux/macOS CI would need a `flowti` shell script or direct `node .flowti/bin/main.js` invocation.

## Success Criteria

- [ ] `npm run test:vault:smoke` passes in under 10 seconds
- [ ] `npm run test:vault:integration` validates both healthy and broken projects
- [ ] `npm run test:vault:ecosystem` validates agent/iteration operations
- [ ] `flowti test:vault --format=json` returns structured `VaultTestResult`
- [ ] Vault test results appear in `flowti state` output
- [ ] CI pipeline runs on push/PR with tier gating
- [ ] Journey files are human-readable without code knowledge
- [ ] Template vault runs in standalone mode (no source tree dependency)

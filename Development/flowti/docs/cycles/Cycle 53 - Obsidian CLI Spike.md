---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: planning
cycle: 53
release_anchor:
  - "Theme 1: Ship It — Release Path"
  - "Theme 5: Architecture — Invest in the Platform"
pbis:
  - "PBI-CLI-001: Obsidian CLI exploration and validation"
  - "PBI-CLI-002: E2E test foundation with Obsidian CLI"
  - "PBI-CLI-003: Plugin command execution via CLI eval"
bugs: []
tech_debt: []
estimated_increments: 6
estimated_tests: 40
pre_cycle_tests: 5776
pre_cycle_suites: 250
---

# Cycle 53 — Obsidian CLI Spike

## Release Anchor Theme

- **Theme 1: Ship It — Release Path** — E2E testing was "blocked on Obsidian CLI availability" — now unblocked.
- **Theme 5: Architecture — Invest in the Platform** — CLI integration enables automated testing, development workflow, and potential AI agent workflows.

## Reprioritization Rationale

Obsidian 1.12 (released 2026-02-11, public 2026-02-27) introduces an official CLI with 100+ commands covering file operations, search, properties, plugins, templates, tasks, daily notes, sync, dev tools, and JavaScript eval. This fundamentally changes three areas of the Flowti roadmap:

1. **E2E Testing** — Previously "blocked on Obsidian CLI availability" (ADR-028, deferred items). Now unblocked. The CLI's `eval` command provides direct access to the Obsidian `app` context, enabling real vault operations, plugin lifecycle testing, and event flow verification without Playwright/Electron overhead.

2. **RB-6 CLI Installer** — Previously deferred to v1.1. Obsidian's `plugin:enable/disable/reload` commands change the installation paradigm. The CLI itself becomes the installer for headless/scripted setups.

3. **Development Workflow** — `plugin:reload` for hot-reload, `dev:console`/`dev:errors` for debugging, `dev:screenshot` for visual regression, `dev:debug` for CDP attachment.

The originally planned Cycle 53 (Data Exchange Evolution: RB-7 pipeline merge, import concurrency, execution timing) is reprioritized to Cycle 54. This spike cycle takes priority because:
- E2E testing was identified as a **release blocker** in the inbox
- The CLI just dropped — early exploration captures first-mover knowledge
- ADR-028 has been "Proposed" since Cycle 9 — now we can resolve it
- Every future cycle benefits from E2E test infrastructure

## Situation Assessment

### Obsidian CLI Capabilities (1.12+)

| Category | Key Commands | Flowti Impact |
|----------|-------------|---------------|
| **Files** | `files`, `file`, `create`, `read`, `append`, `prepend`, `move`, `delete` | Vault fixture management, note creation verification |
| **Properties** | `properties`, `property:set`, `property:remove` | Frontmatter verification, settings testing |
| **Search** | `search`, `search:open` | Verify Flowti search/filter behavior with real index |
| **Links** | `backlinks`, `links`, `unresolved`, `orphans` | Graph integrity testing, traceability verification |
| **Plugins** | `plugins`, `plugin:enable`, `plugin:disable`, `plugin:reload` | Plugin lifecycle testing, hot-reload during dev |
| **Daily** | `daily`, `daily:append`, `daily:prepend` | Session daily note integration testing |
| **Dev** | `eval`, `dev:console`, `dev:errors`, `dev:screenshot`, `dev:dom`, `dev:debug` | JS execution in app context, visual testing, debugging |
| **Tags** | `tags`, `tag` | Tag-based filtering verification |
| **Templates** | `templates`, `templates:apply` | Template-based note creation testing |
| **Bases** | `bases`, `base:query` | Database view integration (future) |
| **Output** | `json`, `csv`, `tsv`, `md`, `yaml`, `paths` formats | Structured assertion data for tests |

### Requirements

- Obsidian 1.12+ running (no headless/daemon mode)
- CLI enabled in Settings > General > Command line interface
- Windows: requires `Obsidian.com` redirector in installation directory

### Open Questions (ADR-028)

All 5 open questions from ADR-028 can now be answered:

1. **Which CLI tool?** → Official Obsidian CLI (1.12+). Community tools are no longer needed.
2. **Vault fixture management?** → `obsidian create`, `obsidian delete`, `obsidian property:set` for setup/teardown.
3. **CI infrastructure?** → Obsidian must be running. CI requires Xvfb or similar display server. Spike must validate this.
4. **Test scope?** → Start with: plugin load, file CRUD, frontmatter round-trip, event verification via `eval`.
5. **Maintenance burden?** → Official CLI with stable API. Lower risk than community tools.

## Cycle Goals

1. **Validate Obsidian CLI works with Flowti** — install, configure, run commands against development vault
2. **Prototype E2E test suite** — 5-10 smoke tests using CLI + Node.js test runner
3. **Explore `eval` for plugin command execution** — run Flowti palette commands from terminal
4. **Update ADR-028** from "Proposed" to "Accepted" with CLI-specific implementation details
5. **Assess RB-6 impact** — determine if Obsidian CLI's plugin management commands make RB-6 moot
6. **Document CLI integration patterns** — reusable patterns for future test authoring

## Scope

### In Scope

- Obsidian CLI setup and configuration on Windows
- E2E test harness: test fixtures, CLI wrapper utilities, assertion helpers
- 5-10 smoke tests covering critical paths (plugin lifecycle, file CRUD, frontmatter, search, event flow)
- `eval`-based command execution prototype
- ADR-028 update
- RB-6 reassessment
- Development workflow integration (`plugin:reload`, `dev:console`)

### Out of Scope

- CI/CD pipeline integration (need data from spike first)
- Full E2E coverage of all 41 flow tests (gradual expansion in future cycles)
- Visual regression testing (`dev:screenshot` — explore but don't commit to)
- Bases integration (`base:query` — explore but defer)
- Mobile CLI (not available)

## Increments

### Inc 1: CLI Setup and Validation
**Theme**: Infrastructure
**Effort**: Small
**Estimate**: +30 LOC production (CLI utility wrapper), +0 LOC test, ~0 tests

Validate Obsidian CLI works with Flowti's development vault:
- Enable CLI in Obsidian 1.12+ settings
- Configure Windows PATH and `Obsidian.com` redirector
- Run basic commands: `obsidian version`, `obsidian vault`, `obsidian files total`, `obsidian plugins versions`
- Verify Flowti plugin appears in `obsidian plugins` output
- Test `obsidian plugin:reload flowti-ibde` for hot-reload
- Document setup steps and requirements

**Acceptance Criteria**:
- [ ] CLI responds to `obsidian version` (v1.12+)
- [ ] `obsidian plugins` lists `flowti-ibde`
- [ ] `plugin:reload flowti-ibde` triggers Flowti's `onunload()/onload()` cycle
- [ ] Setup documented in spike notes

### Inc 2: CLI Wrapper Utilities
**Theme**: Architecture
**Effort**: Medium
**Estimate**: +120 LOC production, +60 LOC test, ~10 tests

Create a reusable CLI wrapper for tests:
- `ObsidianCli` class: wraps `execSync`/`exec` calls to `obsidian` binary
- Methods: `run(command, args)`, `eval(code)`, `createFile(path, content)`, `readFile(path)`, `deleteFile(path)`, `setProperty(file, key, value)`, `search(query)`, `getPlugins()`
- JSON output parsing for structured assertions
- Error handling for CLI failures (Obsidian not running, timeout, etc.)
- Configurable vault targeting via `vault=` parameter

**Acceptance Criteria**:
- [ ] CLI wrapper class with typed methods
- [ ] JSON output parsing for structured data
- [ ] Error handling for CLI failure modes
- [ ] Unit tests for wrapper (mock execSync)
- [ ] `npm test` green

**Test Intent**: ~10 tests covering: run() constructs correct command string (2), eval() wraps code correctly (2), output parsing for JSON/text (3), error handling (2), vault targeting (1).

**Architecture Seams**:
- New: `src/infrastructure/cli/ObsidianCli.ts` — CLI wrapper
- New: `src/infrastructure/cli/types.ts` — CLI types
- New: `tests/infrastructure/cli/ObsidianCli.test.ts`

### Inc 3: E2E Test Harness
**Theme**: Testing
**Effort**: Medium
**Estimate**: +80 LOC test infrastructure, +100 LOC test, ~5 smoke tests

Build the E2E test harness and first smoke tests:
- Test fixture management: create test vault folder, seed files, teardown
- E2E test runner: separate vitest config for E2E (longer timeouts, sequential execution)
- First smoke tests:
  1. Plugin loaded: `obsidian plugins` contains `flowti-ibde`
  2. File CRUD: create → read → verify content → delete
  3. Frontmatter round-trip: `property:set` → `properties` → verify value
  4. Search: create file with known content → `search` → verify found
  5. Plugin reload: `plugin:reload` → verify no errors in `dev:errors`

**Acceptance Criteria**:
- [ ] E2E test harness with setup/teardown
- [ ] 5 smoke tests pass against running Obsidian instance
- [ ] Tests are gated behind environment flag (skip when Obsidian not running)
- [ ] Separate vitest config for E2E

**Architecture Seams**:
- New: `tests/e2e/vitest.e2e.config.ts` — E2E-specific vitest config
- New: `tests/e2e/helpers/fixtures.ts` — vault fixture management
- New: `tests/e2e/smoke.test.ts` — first 5 smoke tests

### Inc 4: Plugin Command Execution via eval
**Theme**: Architecture
**Effort**: Medium
**Estimate**: +60 LOC production, +80 LOC test, ~10 tests

Explore executing Flowti commands from the CLI:
- Use `obsidian eval code="..."` to access `app.plugins.plugins['flowti-ibde']` instance
- Prototype running Flowti commands: `eval` → get plugin instance → call command handler
- Verify event emission: emit event via `eval` → check state via `eval`
- Explore state inspection: read Flowti's in-memory state via `eval` (e.g., session count, inbox count)
- Prototype EventBus interaction: emit events and verify handlers fire

**Acceptance Criteria**:
- [ ] Can access Flowti plugin instance via `eval`
- [ ] Can execute at least one Flowti command via `eval`
- [ ] Can verify event emission via state inspection
- [ ] Tests for `eval`-based interactions
- [ ] `npm test` green (E2E tests gated behind flag)

**Test Intent**: ~10 tests covering: plugin instance access (2), command execution (3), event emission + state verification (3), error cases (2).

### Inc 5: ADR-028 Update and RB-6 Reassessment
**Theme**: Documentation
**Effort**: Small
**Estimate**: +0 LOC production, +0 LOC test, ~0 tests

Update documentation based on spike findings:
- ADR-028: update from "Proposed" to "Accepted", fill in implementation details, resolve all 5 open questions
- RB-6: reassess CLI installer relevance — Obsidian's `plugin:enable/disable/reload` may make it moot
- Update Backlog Refinement with revised cycle roadmap (C53→C54 shift)
- Capture new inbox items for CLI-enabled features
- Update inbox E2E item status

**Acceptance Criteria**:
- [ ] ADR-028 status updated to "Accepted" with CLI-specific details
- [ ] RB-6 reassessed with CLI context
- [ ] Roadmap updated
- [ ] Inbox items captured/updated

### Inc 6: Development Workflow Integration
**Theme**: Developer Experience
**Effort**: Small
**Estimate**: +30 LOC production (scripts), +30 LOC test, ~5 tests

Integrate CLI into development workflow:
- `npm run dev:reload` — triggers `obsidian plugin:reload flowti-ibde`
- `npm run dev:console` — shows recent console output from plugin
- `npm run dev:errors` — shows JavaScript errors
- Update `build:dev` to optionally auto-reload after rebuild
- Document workflow in cycle notes

**Acceptance Criteria**:
- [ ] `npm run dev:reload` reloads plugin
- [ ] `npm run dev:console` shows console output
- [ ] `npm run dev:errors` shows errors
- [ ] Scripts gated behind CLI availability check
- [ ] `npm test` green

**Architecture Seams**:
- Modified: `package.json` — new scripts
- New: `scripts/cli-reload.mjs` — reload wrapper with availability check
- Modified: `esbuild.config.mjs` — optional post-rebuild reload

## Dependency Graph

```
Inc 1 (Setup) ──→ Inc 2 (Wrapper) ──→ Inc 3 (E2E Harness) ──→ Inc 4 (eval Execution)
Inc 1 (Setup) ──→ Inc 5 (ADR/RB-6 Update)
Inc 1 (Setup) ──→ Inc 6 (Dev Workflow)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Obsidian must be running (no headless) | Medium | E2E tests gated behind env flag; CI deferred to future cycle |
| Windows CLI setup complexity | Medium | Document thoroughly in Inc 1; `Obsidian.com` redirector required |
| `eval` security restrictions | Low | Running in dev context with full app access; no production exposure |
| CLI API changes as feature matures | Low | Official Obsidian CLI, active development, community adoption |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~40 (Inc 2: 10, Inc 3: 5 E2E + harness, Inc 4: 10, Inc 5: 0, Inc 6: 5, buffer: 10) |
| E2E smoke tests | 5 passing against live Obsidian |
| CLI wrapper methods | 8+ (run, eval, createFile, readFile, deleteFile, setProperty, search, getPlugins) |
| ADR-028 status | Proposed → Accepted |
| Dev workflow scripts | 3 (reload, console, errors) |
| Increments | 6 |

## Roadmap Impact

### Original Roadmap (Post-C48 Refinement)

| Cycle | Original Theme | Original Focus |
|-------|---------------|----------------|
| **53** | Feature Deepening | Data Exchange: RB-7, import concurrency, execution timing |
| **54** | Feature Deepening | Canvas Sessions, template library, Signal hardening |
| **55** | Ship It | Release gate: PR process, domain docs, final QA |

### Revised Roadmap (Post-CLI Drop)

| Cycle | Revised Theme | Revised Focus |
|-------|--------------|---------------|
| **53** | **CLI Spike** | **Obsidian CLI exploration, E2E foundation, dev workflow** |
| **54** | Feature Deepening | Data Exchange (was C53) + Canvas Sessions (was C54) — compressed |
| **55** | Ship It | Release gate (unchanged) — now with E2E test confidence |

### Why Reprioritize

1. **E2E testing was a release blocker** — inbox item explicitly says "currently blocks v1.0.0". CLI availability resolves this.
2. **ADR-028 has waited 44 cycles** — proposed in Cycle 9, now actionable.
3. **Every future cycle benefits** — E2E infrastructure is a force multiplier.
4. **Data Exchange can compress** — RB-7 (pipeline merge) and import concurrency are self-contained; they can share a cycle with Canvas without dependencies.
5. **First-mover advantage** — CLI just dropped; early exploration establishes patterns before the community converges.

## Deferred Items

| Item | Target | Rationale |
|------|--------|-----------|
| CI/CD pipeline for E2E tests | Post-spike | Need spike data to design CI approach (Xvfb, Obsidian binary in CI) |
| Full E2E coverage of 41 flow tests | Gradual, per-cycle | Start with 5 smoke tests; expand as patterns stabilize |
| Visual regression testing | Future cycle | `dev:screenshot` is promising but not critical path |
| Bases integration via CLI | Future cycle | `base:query` available but no Flowti Bases support yet |
| Mobile CLI | Not available | CLI is desktop-only |

---
type: Roadmap
domain: CLI
title: Flowti CLI — Development Roadmap
version: 1
created: 2026-03-09
updated: 2026-03-09
status: active
source: "[[Flowti CLI PRD]]"
architecture: "[[Flowti CLI Architecture]]"
---

# Flowti CLI — Development Roadmap

> Synthesized from PRD v10, Architecture v18, and codebase analysis (1,780 tests, 171 source files, 23,263 LOC). Prioritizes **test hardening → refactoring → features** to maintain quality as the codebase grows.

---

## Current State (2026-03-09)

| Metric | Value |
|--------|-------|
| Source files | 171 |
| Test files | 110 |
| Tests passing | 1,780 (101 suites) |
| Source LOC | ~23,263 |
| Test LOC | ~21,286 |
| Domains | 18 |
| Infrastructure modules | 21 |
| Non-interactive commands | 84 |
| Dependencies | 0 (runtime) |
| Feature Requests (PRD) | 22 (FR-01 – FR-22) |
| Improvements (PRD) | 45 (IMP-01 – IMP-45) |
| Completed FRs | 20/22 (FR-21, FR-22 pending) |
| Completed IMPs | 20/45 (44%) |

---

## Priority 0: Test Hardening

**Goal**: Bring under-tested domains to a minimum coverage baseline before adding features. These domains have the worst test-to-source ratios and are at risk of silent regressions.

| # | Domain | Source LOC | Test Files | Gap | Target Tests |
|---|--------|-----------|------------|-----|-------------|
| T-01 | **ai-tools** (5 src, 1 test) | 574 | `ai-tool-loader.test.ts` (30 tests) | `ai-tool-commands.ts` (213 LOC), `ai-tool-reference.ts`, `ai-tool-types.ts` untested | +15–20 |
| T-02 | **plugins** (5 src, 1 test) | 578 | `plugin-loader.test.ts` (34 tests) | `plugin-commands.ts`, `plugin-reference.ts` untested | +15–20 |
| T-03 | **info** (1 src, 1 test) | 229 | `info.test.ts` | Low coverage of edge cases (missing package.json, no git, empty config) | +8–10 |
| T-04 | **capture** (1 src, 1 test) | 149 | `capture.test.ts` (35 tests) | Decent count but no edge cases for file conflicts, empty text, special chars | +5–8 |
| T-05 | **health** (2 src, 2 tests) | 407 | `health.test.ts`, `health-scoring.test.ts` | Missing: threshold edge cases, empty snapshots, malformed report frontmatter | +10–12 |
| T-06 | **help** (1 src, 2 tests) | 371 | `help.test.ts`, `help-content.test.ts` | Missing: unknown section handling, ANSI stripping, section completeness | +8–10 |
| T-07 | **onboarding** (1 src, 2 tests) | 103 | `onboarding.test.ts`, `onboarding-commands.test.ts` | Small module — verify first-run detection and config scaffold | +4–6 |
| T-08 | **knowledgebase** (2 src, 2 tests) | 234 | Tests exist but vault-service edge cases uncovered | CLI unavailable, timeout, malformed JSON search results | +6–8 |

**Estimated effort**: 2–3 days. **Target**: +70–90 new tests, bringing total to ~1,860.

**Priority rule**: No new feature work on a domain until its test coverage is at the baseline.

---

## Priority 1: Refactoring

**Goal**: Reduce maintenance cost and improve extensibility before Phase 5 features.

### R-01: Extract help text constants (help.ts — 371 LOC)

The help system embeds all text as template literals inside the function body. Extract to a `help-content.ts` data file (section ID → content string) so:
- Help text is testable independently
- New sections don't require touching control flow
- AI agents can parse help content programmatically

**Effort**: S (< 1 day)

### R-02: Report generator discriminated unions

Report generators currently use a loose `GeneratorOutput` type. Introduce a discriminated union:
```typescript
type GeneratorResult =
  | { status: "pass"; output: string; warnings: string[] }
  | { status: "fail"; error: string }
  | { status: "skip"; reason: string };
```
This enables exhaustive switch/case handling and eliminates null-checking ambiguity.

**Effort**: S (< 1 day)

### R-03: Command registry consolidation

84 commands are spread across `commands` exports in each domain file and assembled in `main.ts`. Consider a `CommandRegistry` pattern (similar to the existing `GeneratorRegistry`) that:
- Auto-discovers commands from domain modules
- Validates for duplicates at startup
- Powers `--json` output introspection (needed for Phase 5.1)

**Effort**: M (1–3 days)

### R-04: Break up large files

8 source files exceed 300 LOC. The largest are in `reports/` (summary-analyzers, summary-renderers, summary-loaders). These are well-tested but hard to navigate. Consider extracting:
- `summary-analyzers.ts` → per-analyzer files (lint, coverage, test, build)
- `storybook-service.ts` → separate `storybook-installer.ts` and `storybook-runner.ts`

**Effort**: M (1–3 days), low risk given high test coverage

---

## Phase 5: Agent-Native & DX (from PRD)

**Goal**: Make every command usable by both humans and AI agents.

| # | Work Item | IMP | Priority | Effort | Dependencies |
|---|-----------|-----|----------|--------|-------------|
| 5.1 | **`--json` output flag** — Structured JSON on all commands | IMP-28 | Critical | L | R-03 (CommandRegistry) |
| 5.2 | **Quality Gates** — Configurable thresholds that block publish | IMP-29 | High | M | T-05 (health tests) |
| 5.3 | **Scaffold `--dry-run`** — Preview files without writing | IMP-30 | High | S | — |
| 5.4 | **Global output flags** — `--quiet`, `--verbose`, `--no-color`, `--yes` | IMP-34 | High | M | 5.1 |
| 5.5 | **Progress indicators** — Spinners and progress bars | IMP-31 | Medium | M | — |
| 5.6 | **Post-command suggestions** — Next-step hints after operations | IMP-33 | Medium | S | — |
| 5.7 | **Report diff mode** — Compare current vs previous reports | IMP-32 | Medium | M | — |

**Exit criteria**: Every command supports `--json`. Publish is gated by quality thresholds. CI pipelines can run headlessly.

---

## Phase 6: Depth (from PRD)

**Goal**: Turn "Shallow" features into reliable tools.

| # | Work Item | IMP | Priority | Effort | Dependencies |
|---|-----------|-----|----------|--------|-------------|
| 6.1 | **Capture enrichment** — Tags, search, batch import | IMP-22 | High | M | T-04 (capture tests) |
| 6.2 | **Event contract validation** — Runtime payload checks in Vitest | IMP-18 | High | L | — |
| 6.3 | **Health trends** — Snapshot persistence, delta indicators | IMP-26 | Medium | M | T-05 (health tests) |
| 6.4 | **AI Tool execution** — `ai:run --tool=X` with param substitution | IMP-24 | Medium | L | T-01 (ai-tools tests) |
| 6.5 | **npm audit integration** — Security in health scoring | IMP-41 | Medium | S | 5.2 |
| 6.6 | **Technical debt estimation** — Remediation time from metrics | IMP-42 | Low | M | 5.2 |
| 6.7 | **Marketplace export** — Share definitions across vaults | IMP-25 | Low | M | — |
| 6.8 | **Event TypeScript codegen** — Interfaces from contracts | IMP-18 | Low | M | 6.2 |

**Exit criteria**: Capture has tags and search. Event contracts validate in CI. Health tracks trends.

---

## Phase 7: Ecosystem (from PRD)

**Goal**: Force multiplier across projects, teams, and AI agents.

| # | Work Item | IMP | Priority | Effort | Dependencies |
|---|-----------|-----|----------|--------|-------------|
| 7.1 | **Shell completions** — bash/zsh/fish/powershell | IMP-35 | Medium | M | R-03 |
| 7.2 | **Change-based selective review** — git diff analysis | IMP-36 | Medium | L | — |
| 7.3 | **Report caching** — Hash-based invalidation | IMP-43 | Medium | M | — |
| 7.4 | **Parallel report generation** — Concurrent independent generators | IMP-45 | Medium | M | R-02 |
| 7.5 | **Interactive dependency browser** — Visual project graph | IMP-27 | Medium | L | — |
| 7.6 | **Template versioning** — Re-apply scaffolds with conflict resolution | IMP-40 | Medium | L | — |
| 7.7 | **HTML report export** — Shareable reports outside Obsidian | IMP-44 | Low | M | — |
| 7.8 | **Self-update** — Detect source changes and rebuild | IMP-12 | Low | M | — |
| 7.9 | **Plugin lifecycle hooks** — onBefore/onAfter hooks in manifests | IMP-37 | Low | L | T-02 |
| 7.10 | **Cross-vault sharing** — Remote plugin/definition registry | IMP-25 | Low | XL | 6.7, 7.9 |

**Deferred** (revisit after Phase 7): MCP server mode (IMP-38), AGENTS.md generation (IMP-39), CI/CD generation (IMP-11).

**Exit criteria**: Reports are cacheable and parallelizable. Plugin ecosystem supports lifecycle management. Shell completions available.

---

## Suggested Execution Order

```
Priority 0 ──► Priority 1 ──► Phase 5 ──► Phase 6 ──► Phase 7
(tests)        (refactoring)   (agent DX)   (depth)     (ecosystem)

Sprint 1:  T-01..T-04  +  R-01, R-02          (~3 days)
Sprint 2:  T-05..T-08  +  R-03                (~3 days)
Sprint 3:  5.1 (--json) + 5.3 (--dry-run)     (~5 days)
Sprint 4:  5.2 (quality gates) + 5.4 (flags)  (~4 days)
Sprint 5:  5.5..5.7 + R-04                    (~4 days)
Sprint 6:  6.1 (capture) + 6.2 (contracts)    (~5 days)
Sprint 7:  6.3 (trends) + 6.4 (ai-tool exec)  (~5 days)
Sprint 8+: Phase 7 items by priority            (ongoing)
```

---

## Key Metrics to Track

| Metric | Current | Sprint 2 Target | Phase 5 Target |
|--------|---------|----------------|----------------|
| Tests | 1,780 | 1,860+ | 2,100+ |
| Test suites | 101 | 115+ | 130+ |
| Commands with `--json` | 0 | 0 | 84 |
| Quality gate rules | 0 | 0 | 5+ |
| Files > 300 LOC | 8 | 6 | 4 |
| Shallow features | 5 | 5 | 2 |
| Deep features | 12 | 12 | 14 |

---

## Appendix: Feature Maturity Progression

| Feature | Current | After P0+P1 | After Phase 5 | After Phase 6 |
|---------|---------|-------------|---------------|---------------|
| Agent-Native (FR-21) | Shallow | Shallow | **Deep** | Deep |
| Quality Gates (FR-22) | Not Started | Not Started | **Functional** | Deep |
| AI Tools (FR-14) | Shallow | Shallow | Shallow | **Functional** |
| Capture (FR-02.11) | Shallow | Shallow | Shallow | **Functional** |
| Event Contracts (FR-18) | Shallow | Shallow | Shallow | **Functional** |
| Health Dashboard (FR-15) | Functional | Functional | Functional | **Deep** |
| Marketplace (FR-17) | Shallow | Shallow | Shallow | **Functional** |

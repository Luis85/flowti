---
type: DevelopmentCycle
feature: "[[Release Preparation PRD]]"
stage: planned
cycle: 16
date_planned: 2026-02-22
date_completed:
pbis: []
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-29 Error handling inconsistency]]"
  - "[[TD-122 Systemic empty catch blocks]]"
estimated_increments: 8
actual_increments:
estimated_tests: 80
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 16: Improvement Sprint

## Cycle Overview

**User Story:**

> As the product owner, I want to invest a full cycle in quality, release readiness, and polish so that the plugin is closer to publishable state and the codebase is healthier for future feature cycles.

**User Pains:**
- 5 release blockers remaining (RB-1, RB-2, RB-4, RB-7, RB-8) — plugin cannot be published on marketplace
- 62 catch blocks using 4 inconsistent error handling strategies — debugging is harder than necessary
- 22 empty catch blocks silently swallowing errors — failures go unnoticed
- ~35 UI components remain untested — silent regressions possible
- Missing flow tests for session nudges and path reconciliation — OBS-2 and OBS-3 from Three Amigos unresolved
- Plugin not audited against Obsidian's published submission requirements — unknown gaps to marketplace listing
- Cycle 15 Three Amigos review still pending

**User Needs:**
- Repository structure compatible with Obsidian marketplace (package.json at root)
- ESLint compliance with Obsidian-specific rules
- Consistent error handling strategy across all domains
- Missing test coverage for critical UI components and flow tests
- Compliance audit against Obsidian's published plugin submission requirements
- Quick UX wins: daily tracking toggle, small polish items
- Clear improvement backlog with scored items for subsequent cycles

---

## Situation Assessment

### Pre-Cycle State

**Plugin health:**
- 3,548 tests passing, 141 test suites
- Build status: green
- Cycles 11-15 feature-heavy: Azure DevOps, User Hub Inbox, Train of Thoughts, Train View Polish, Canvas Integration

**Feature status:**
- 16 domains, 35 features delivered across Cycles 1-15
- Cycles 11-15 were feature-heavy — no dedicated quality cycle since Cycle 10 (Refactoring and Technical Debt Cleanup)

**Release blocker status:**
- 3/8 resolved: RB-3, RB-5, RB-6
- 5 remaining: RB-1 (repo structure), RB-2 (ESLint compliance), RB-4 (seed content), RB-7 (pipeline merge), RB-8 (CLI installer)

**Tech debt status:**
- 0 critical, 0 high, 5 medium, ~45 low
- 63 resolved, 5 mitigated
- TD-29 (error handling inconsistency) and TD-122 (systemic empty catch blocks) are the focus for this cycle

**Market context:**
- 2,736+ Obsidian community plugins, 97M+ total downloads
- Top user needs: task management, data querying, AI integration
- Flowti consolidates multiple plugin functions (session tracking, event catalogs, documentation pipelines, data exchange) into one stable plugin
- Marketplace listing requires repository structure compliance, ESLint standards, and submission audit

**Unresolved review observations (Three Amigos):**
- OBS-2: Session nudge flow test missing — nudge trigger → notice → accept/dismiss → session start untested
- OBS-3: Path reconciliation edge cases — file/folder rename impact on session fields not tested
- OBS-4: Daily tracking toggle — no user-facing setting to disable automatic daily session tracking

---

## Cycle Goals

1. **Release infrastructure** (Inc 1-2) — Restructure repository for marketplace compatibility + ESLint compliance with Obsidian-specific rules
2. **Error handling & testing** (Inc 3-5) — Standardize error patterns across all domains, close critical flow test gaps, expand UI test coverage
3. **Submission compliance & polish** (Inc 6-7) — Audit against Obsidian marketplace requirements, fix violations, deliver quick UX wins
4. **Improvement backlog** (Inc 8) — Per-area scored backlog with market intelligence for future cycle planning

---

## Scope

### In Scope
- RB-1: Repository restructure (package.json at root)
- RB-2: Obsidian ESLint compliance
- TD-29: Error handling inconsistency audit and standardization
- TD-122: Systemic empty catch blocks — review, justify, or fix all 22
- OBS-2: Session nudge flow test
- OBS-3: Path reconciliation edge case tests
- OBS-4: Daily tracking disable toggle
- Submission compliance audit against Obsidian marketplace requirements
- Improvement backlog with per-area scored items
- Market research document for competitive positioning

### Out of Scope
- New features — this is an improvement cycle
- RB-4: Seed starter content (new feature work)
- RB-7: Pipeline multi-source merge (feature enhancement)
- RB-8: CLI-based installer (major new capability)
- AI integration (new feature — market research informs future planning)
- Mobile optimization (platform constraint — not plugin-addressable)

---

## Tech Debt Bundled

- **TD-29** — Error handling inconsistency: 62 catch blocks using 4 different strategies
- **TD-122** — Systemic empty catch blocks: 22 empty catches silently swallowing errors

---

## Increments

### Inc 1: Repository Restructure (RB-1)

**Goal:** Move meta-files to repo root so `npm install && npm run build && npm test` work from the git root.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `package.json` (root) | Move from Development/flowti/ to repo root, update all relative paths | ~0 (move) |
| 2 | `manifest.json` (root) | Move to repo root | ~0 (move) |
| 3 | `tsconfig.json` (root) | Move to repo root, update include/exclude paths | ~5 |
| 4 | `esbuild.config.mjs` (root) | Move to repo root, update entry/output paths | ~10 |
| 5 | `.gitignore` (root) | Update for new structure | ~5 |
| 6 | `versions.json` (root) | Move to repo root | ~0 (move) |

**Est. total:** ~20 LOC changes, ~0 new tests (validate with existing 3,548 tests)

**Test intent:** All 3,548 existing tests pass from repo root. Build produces valid main.js.

**Documentation intent:** Update README with new build instructions.

**Architecture seams:** Build system (esbuild) entry point changes. All source code stays in Development/flowti/src/. Test paths may need tsconfig baseUrl adjustment.

**Acceptance criteria:**
- [ ] `npm install` works from repo root
- [ ] `npm run build` produces main.js from repo root
- [ ] `npm test` passes all 3,548 tests from repo root
- [ ] `npm run check` passes (tsc + eslint) from repo root
- [ ] manifest.json, package.json, versions.json at repo root
- [ ] GitHub Actions (if any) would find files at expected paths

---

### Inc 2: Obsidian ESLint Compliance (RB-2)

**Goal:** Configure Obsidian-specific ESLint rules and fix all violations.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `eslint.config.mjs` | Add Obsidian-specific rules (no innerHTML, no global app, sentence case, etc.) | ~30 |
| 2 | Source files | Fix innerHTML/outerHTML violations (replace with createEl/createDiv) | ~50 |
| 3 | Source files | Fix command naming (sentence case, no redundant prefixes) | ~10 |
| 4 | Source files | Fix any hardcoded inline styles → CSS classes | ~20 |

**Est. total:** ~110 LOC changes, ~0 new tests

**Test intent:** `npm run check` passes with new rules. No functional changes — only ESLint compliance.

**Documentation intent:** Document Obsidian ESLint rules in a code quality guide or ADR.

**Architecture seams:** ESLint config extends existing flat config. Rules target UI layer primarily. No domain logic changes.

**Acceptance criteria:**
- [ ] Obsidian-specific ESLint rules configured and passing
- [ ] No innerHTML/outerHTML with user input anywhere in codebase
- [ ] All commands use sentence case naming
- [ ] No hardcoded inline styles (CSS classes used instead)
- [ ] `npm run check` passes with zero violations
- [ ] `npm test` passes (no functional regressions)

---

### Inc 3: Error Handling Standardization (TD-29, TD-122)

**Goal:** Audit, document, and fix error handling patterns across the codebase.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | Audit | Catalog all 62 catch blocks and 22 empty catches with classification | ~0 |
| 2 | `docs/decisions/ADR-035 Error Handling Convention.md` | Define 3 strategies: log+continue, rethrow, user-notify | ~50 (doc) |
| 3 | ~10 source files | Fix 2-3 truly silent catches that mask real errors | ~30 |
| 4 | ~5 source files | Add `// intentional: <reason>` comments to justified empty catches | ~10 |

**Est. total:** ~40 LOC code changes, ~50 LOC ADR, ~5 new tests

**Test intent:** Tests for the 2-3 fixed catches to verify they now surface errors correctly. Existing tests pass.

**Documentation intent:** ADR-035 Error Handling Convention. Annotated empty catches with justification comments.

**Architecture seams:** Error handling is cross-cutting. Changes are surgical per-catch — no new abstractions needed. The ADR establishes convention for future code.

**Acceptance criteria:**
- [ ] All 62 catch blocks cataloged and classified
- [ ] All 22 empty catches reviewed: justified → commented, unjustified → fixed
- [ ] ADR-035 created with 3 error handling strategies
- [ ] Zero unjustified empty catches remaining
- [ ] `npm test` passes

---

### Inc 4: Missing Flow & Integration Tests (OBS-2, OBS-3)

**Goal:** Close critical testing gaps identified in Three Amigos reviews.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/14-SessionNudges.test.ts` (new) | Nudge flow: trigger → notice → accept/dismiss → session start | ~150 |
| 2 | `tests/domain/session/pathReconciliation.test.ts` (new) | Path reconciliation edge cases for file/folder renames | ~100 |
| 3 | `docs/reviews/Three Amigos Review - Cycle 15 Canvas.md` (new) | Cycle 15 Three Amigos review closure document | ~80 (doc) |

**Est. total:** ~250 LOC tests, ~80 LOC review doc, ~20 new tests

**Test intent:** Flow 14 covering nudge trigger → Notice → accept → session start (~8 tests). Path reconciliation: file rename across 7 session fields + templates (~12 tests). Three Amigos review documents Cycle 15.

**Documentation intent:** Three Amigos Review - Cycle 15 closure document. OBS-2 and OBS-3 marked resolved.

**Architecture seams:** Flow tests follow established `tests/flows/` pattern. Path reconciliation tests use existing mock factories (`createMockStorage`, `createMockFileSystem`).

**Acceptance criteria:**
- [ ] Flow 14 (SessionNudges) created with ~8 tests covering nudge lifecycle
- [ ] Path reconciliation tests covering file/folder rename across session fields (~12 tests)
- [ ] Cycle 15 Three Amigos review documented
- [ ] OBS-2 and OBS-3 marked resolved
- [ ] `npm test` passes with ~20 new tests

---

### Inc 5: UI Component Test Coverage

**Goal:** Add tests for the 3 highest-impact untested UI components.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/ui/catalog/EventsTab.test.ts` (new) | Event Catalog Events tab rendering and interaction | ~200 |
| 2 | `tests/ui/catalog/CatalogDashboard.test.ts` (new) | Catalog dashboard rendering, statistics, navigation | ~150 |
| 3 | `tests/ui/hub/HubDashboard.test.ts` (new) | DX Hub dashboard rendering, stat cards, navigation | ~150 |

**Est. total:** ~500 LOC tests, ~45 new tests

**Test intent:** EventsTab: renders event list, filters by category, shows detail panel (~15 tests). CatalogDashboard: renders stats, category cards, quick actions (~15 tests). HubDashboard: renders stat cards, import/export counts, navigation (~15 tests).

**Documentation intent:** Note test pattern in Frontend Architecture (established UI test template).

**Architecture seams:** Follow existing `DomainsTab.test.ts` pattern: mock deps interface, mock EventBus, render into jsdom container, assert DOM state.

**Acceptance criteria:**
- [ ] EventsTab test suite: ~15 tests (render, filter, detail)
- [ ] CatalogDashboard test suite: ~15 tests (stats, cards, actions)
- [ ] HubDashboard test suite: ~15 tests (stats, navigation)
- [ ] All 3 test files follow established DomainsTab pattern
- [ ] `npm test` passes with ~45 new tests

---

### Inc 6: Submission Compliance Audit

**Goal:** Audit the plugin against all Obsidian marketplace submission requirements.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `docs/reviews/Obsidian Submission Compliance Audit.md` (new) | Full audit: manifest, description, code patterns, security, UI/UX, resources | ~200 (doc) |
| 2 | Source files (if trivial) | Fix any trivial violations found during audit | ~20 |

**Est. total:** ~200 LOC doc, ~20 LOC fixes, ~0 new tests

**Test intent:** No new tests — this is an audit producing a compliance report.

**Documentation intent:** Full compliance audit document with pass/fail per Obsidian requirement category: Manifest, Description, Code Quality, Security, UI/UX, Resource Management, File Operations, TypeScript Standards.

**Architecture seams:** Audit is read-only analysis. Trivial fixes (e.g., missing period in description) are applied immediately. Non-trivial violations feed into Inc 7.

**Acceptance criteria:**
- [ ] Compliance audit document created with all Obsidian submission requirements checked
- [ ] Each requirement has pass/fail status with evidence
- [ ] Non-trivial violations cataloged with fix effort estimate
- [ ] Trivial violations fixed immediately
- [ ] Audit covers: manifest, description, innerHTML, command naming, resource cleanup, file operations

---

### Inc 7: Quick Wins & UX Polish

**Goal:** Fix compliance violations and deliver small UX improvements.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | Source files | Fix non-trivial compliance violations from Inc 6 audit | ~50 |
| 2 | `src/domain/session/SessionService.ts` | OBS-4: Add daily tracking disable toggle | ~30 |
| 3 | `tests/domain/session/SessionService.test.ts` | Tests for tracking toggle | ~40 |
| 4 | `src/domain/settings/types.ts` | Add `disableDailyTracking?: boolean` setting | ~5 |
| 5 | Source files | Top 3 quick-win UX fixes from inbox | ~30 |

**Est. total:** ~155 LOC source, ~40 LOC tests, ~8 new tests

**Test intent:** Daily tracking toggle: enable/disable setting, session respects setting, default is enabled (~8 tests).

**Documentation intent:** Update settings documentation with new toggle.

**Architecture seams:** Setting added to FlowtiSettings type. SessionService checks setting during daily session creation. Compliance fixes are per-violation (no new patterns).

**Acceptance criteria:**
- [ ] All non-trivial compliance violations from Inc 6 resolved
- [ ] Daily tracking disable toggle implemented and tested
- [ ] `disableDailyTracking` setting added to FlowtiSettings
- [ ] 3 quick-win UX fixes delivered
- [ ] `npm run check` passes (all Obsidian rules clean)
- [ ] `npm test` passes with ~8 new tests

---

### Inc 8: Improvement Backlog & Market Intelligence

**Goal:** Create comprehensive improvement backlog and market research document for future cycle planning.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `docs/features/Improvement Backlog.md` (new) | Per-area scored backlog: Release Readiness, Quality, Polish | ~300 (doc) |
| 2 | `docs/features/Obsidian Market Research 2026.md` (new) | Ecosystem stats, user pain points, competitive positioning, submission reqs | ~250 (doc) |
| 3 | `docs/cycles/Release Preparation Cycle.md` | Update release blocker status, release readiness assessment | ~20 |

**Est. total:** ~570 LOC docs, ~0 new tests

**Test intent:** No new tests — this is a documentation and planning increment.

**Documentation intent:** Two major documents: Improvement Backlog (structured per-area with severity/effort/impact/recommended cycle per item) and Market Research (ecosystem data, user needs, Flowti positioning). Release readiness percentage assessment.

**Architecture seams:** No code changes. Documents reference existing TD items, inbox items, and PRDs via wikilinks.

**Acceptance criteria:**
- [ ] Improvement Backlog created with all remaining items scored (severity, effort, user impact, recommended cycle)
- [ ] Items grouped by area: Release Readiness, Quality & Stability, Polish & UX
- [ ] Market Research document with ecosystem stats, user pain points, competitive landscape
- [ ] Flowti positioning analysis against top Obsidian plugins
- [ ] Release readiness percentage assessed (e.g., "X of Y requirements met")
- [ ] Release blocker status updated

---

## Dependency Graph

```
Inc 1 (Repo Restructure) ─── GATE ───→ Inc 2 (ESLint Compliance)

Inc 3 (Error Handling) ──→ Inc 4 (Flow Tests) ──→ Inc 5 (UI Tests)

Inc 6 (Submission Audit) ──→ Inc 7 (Quick Wins)

All above ──→ Inc 8 (Improvement Backlog)
```

Note: The three tracks (Inc 1-2, Inc 3-5, Inc 6-7) can run in parallel. Inc 8 is last because it needs the full picture.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Repo restructure breaks build paths | High | Run full test suite after each path change; git stash for rollback |
| ESLint Obsidian plugin not mature | Medium | Manually configure equivalent rules if plugin has issues |
| Error handling audit reveals more issues than expected | Medium | Focus on the 2-3 truly silent catches; document others for future |
| UI component tests require complex mocking | Medium | Follow established DomainsTab pattern; skip components needing Obsidian runtime |
| Compliance audit finds major gaps | Medium | Prioritize security violations; defer cosmetic issues to improvement backlog |
| Quick wins scope creep | Low | Limit to 3 pre-selected items; defer others to backlog |

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New tests | ~80 | | |
| Release blockers closed | 2 (RB-1, RB-2) | | |
| Empty catches resolved | 22 → 0 unjustified | | |
| UI components tested | +3 | | |
| Compliance audit | complete | | |
| Improvement backlog | created | | |
| Market research | created | | |
| Build from root | working | | |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| RB-4: Seed starter content | New feature work — deferred to post-improvement cycle | Cycle 18 |
| RB-7: Pipeline multi-source merge | Feature enhancement — not quality work | Cycle 18 |
| RB-8: CLI-based installer | Major new capability — not improvement scope | Cycle 18 |
| Remaining ~32 untested UI components | 3 highest-impact tested this cycle; rest in improvement backlog | Future |
| TD-43: Correlation IDs | Infrastructure enhancement — not blocking | Future |
| TD-48: CSV parsing blocks UI | Low priority — acceptable at current scale | Future |
| AI integration | New feature — market research informs future planning | Future |
| Mobile optimization | Platform constraint — not plugin-addressable | Out of scope |

---

## DoR Preparation Notes

### Already Ready
- [x] Release Preparation PRD exists with RB-1 through RB-8 documented
- [x] TD-29 and TD-122 documented with affected files
- [x] OBS-2, OBS-3, OBS-4 documented in Three Amigos review
- [x] Obsidian submission requirements researched and documented
- [x] Market research data collected (ecosystem stats, user pain points, competitive landscape)
- [x] DomainsTab.test.ts exists as UI test pattern exemplar
- [x] Build pipeline green (3,548 tests)

### Gaps to Close

| # | Gap | Action |
|---|-----|--------|
| 1 | eslint-plugin-obsidian availability | Verify plugin exists or plan manual rule configuration |
| 2 | Repo restructure impact on .obsidian/plugins/ output | Verify esbuild output path still works after move |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred increments documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes from repo root (post-restructure)
- [ ] `npm run check` passes with Obsidian ESLint rules
- [ ] Test count meets target (~80 new tests)
- [ ] No test regressions
- [ ] Error handling ADR created and followed

### 3. Release Readiness
- [ ] RB-1 resolved (repo at root)
- [ ] RB-2 resolved (ESLint compliance)
- [ ] Submission compliance audit complete
- [ ] Release readiness percentage assessed

### 4. Documentation
- [ ] ADR-035 Error Handling Convention created
- [ ] Obsidian Submission Compliance Audit created
- [ ] Improvement Backlog created with scored items
- [ ] Market Research document created
- [ ] Three Amigos Cycle 15 review documented

### 5. Cycle Plan Completion
- [ ] Cycle plan frontmatter updated with actual values
- [ ] Success metrics verified
- [ ] Deviations documented

---

## Related
- PRD: [[Release Preparation PRD]]
- Tech Debt: [[TD-29 Error handling inconsistency]], [[TD-122 Systemic empty catch blocks]]
- Release Blockers: RB-1, RB-2
- Review: OBS-2, OBS-3, OBS-4 from [[Three Amigos Review 2026-02-19 Session Workspaces]]
- Prior Cycle: [[Cycle 15 - Canvas Integration]]
- Next Cycle: [[Cycle 17 - Backlog Intelligence]]
- Backlog Refinement: [[backlog-refinement-2026-02-22]]

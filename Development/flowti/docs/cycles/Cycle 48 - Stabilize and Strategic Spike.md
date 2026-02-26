---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 47]]"
stage: planned
cycle: 48
date_planned: 2026-02-26
date_completed:
pbis:
  - "[[PBI-BUG-001 Quick Capture YAML Sanitization]]"
  - "[[PBI-BUG-002 Session Note Activity Log Bloat]]"
  - "[[PBI-TD-118 Session Helpers Decomposition]]"
  - "[[PBI-RB-002 Obsidian ESLint Rules]]"
  - "[[PBI-SIG-007 Signal Secret Storage Migration]]"
  - "[[PBI-SPK-001 Bases Integration Spike]]"
  - "[[PBI-CAP-001 Auto-Truncating Titles]]"
bugs:
  - "Quick Capture YAML-breaking description field"
  - "Session note saves raw activity log instead of aggregated"
bugs_fixed_precycle: []
bugs_fixed: []
tech_debt:
  - "TD-118: session/helpers.ts (982 LOC, 5 mixed concerns)"
tech_debt_resolved: []
estimated_increments: 7
actual_increments:
estimated_tests: 60
actual_new_tests:
pre_cycle_tests: 5283
pre_cycle_suites: 221
post_cycle_tests:
post_cycle_suites:
---

# Cycle 48 — Stabilize + Strategic Spike

## Cycle Overview

**User Story:**

> As a Flowti developer and user, I want the plugin to be stable, secure, and aligned with the Obsidian ecosystem — so that I can confidently build the next wave of features (Signal v2, AI, Command Catalog) on a clean foundation.

**User Pains:**

- **Quick Capture breaks YAML** — Entering special characters (colons, quotes, newlines) in the description field of the Quick Capture modal corrupts the YAML frontmatter. Notes become unparseable. Data corruption risk on every capture.
- **Session notes bloat with raw events** — When saving a Session Note, the full raw event-level activity log is persisted instead of only the aggregated log. Session notes grow unbounded, consuming vault space and slowing rendering.
- **session/helpers.ts is unmaintainable** — At 982 LOC, it is the largest file in the entire codebase. It combines 5 distinct responsibilities (summary generation, reverse parsing, template rendering, formatting, utilities). The corresponding test file is ~85K. Any session change risks merge conflicts and cognitive overload.
- **Signal secrets are insecure** — Azure DevOps PATs are stored outside Obsidian's Secret Storage API. This blocks further Signal expansion (Jira, GitHub adapters) and is a security risk for any user with external integrations.
- **No Obsidian ESLint rules** — The plugin cannot be published to the Obsidian marketplace without conforming to the marketplace ESLint policy. RB-2 is a release blocker, currently in-progress but incomplete.
- **No Bases integration** — Obsidian 1.10 shipped the Bases core plugin with a plugin API for custom view types. Flowti's analytics views run parallel to Bases rather than integrating with it. This is a missed ecosystem alignment opportunity.
- **Long titles break on Windows** — Notes with long titles hit the Windows MAX_PATH limit (260 chars), causing file creation failures. No truncation or fallback exists.

**Business Trigger:** The post-Cycle 47 backlog refinement (414 items triaged, 88 archived/merged) identified 2 bugs, 1 high-severity tech debt, 1 security risk, and 1 release blocker as P1 priorities. Market research revealed Bases integration and AI as the two highest-impact strategic opportunities. This cycle stabilizes the foundation and runs a spike to validate the Bases integration path before committing to a full cycle.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 47)

**Plugin health:**
- 5,283 tests passing, 221 test suites
- Build status: green (`npm test` clean)
- No blocking bugs from Cycle 47

**Known bugs:**
- Quick Capture description field writes directly into YAML frontmatter. Special characters break YAML parsing. Needs sanitization or move to markdown body.
- Session note save includes raw event entries. Only aggregated activity log should be persisted.

**Tech debt (relevant to this cycle):**
- TD-118: `session/helpers.ts` — 982 LOC, 5 mixed concerns. Highest-severity open debt item.
- TD-23: `InstallerWizardModal` — 774 LOC (stable, runs once per vault, lower priority)
- TD-128: `DashboardsTab.ts` — 1,149 LOC (deferred, not blocking)

**Signal domain status:**
- AzureDevOpsAdapter stores PAT in plugin settings (plain `data.json`)
- Obsidian provides `Plugin.loadData()` / `Plugin.saveData()` for settings but has no built-in secret storage
- Investigation needed: evaluate `obsidian-secret-storage` community pattern or encrypted field approach

**ESLint status:**
- Standard ESLint config exists (TypeScript rules)
- No Obsidian-specific marketplace rules implemented
- RB-2 release blocker partially in-progress

**Obsidian Bases status:**
- Obsidian 1.10 introduced Bases core plugin
- Plugin API available: `Plugin.registerBasesView()` for custom view types
- No Flowti integration exists — analytics views are standalone

---

## Backlog Refinement

### Inbox Items Processed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| Vault inbox | Quick Capture YAML-breaking bug | **IN SCOPE** (Inc 1) | P1 bug. Data corruption risk. |
| Vault inbox | Session note activity log bloat | **IN SCOPE** (Inc 2) | P1 bug. Notes grow unbounded. |
| Tech debt register | TD-118 session/helpers.ts decomposition | **IN SCOPE** (Inc 3) | Highest-severity open tech debt. 982 LOC monolith. |
| Plugin inbox | RB-2 Obsidian ESLint rules | **IN SCOPE** (Inc 4) | Release blocker. Marketplace requirement. |
| Vault inbox | Signal secret storage risk | **IN SCOPE** (Inc 5) | Security risk. Blocks Signal v2. |
| Vault inbox | Bases integration exploration | **IN SCOPE** (Inc 6) | Strategic spike. Validates ecosystem alignment. |
| Vault inbox | Auto-truncating titles | **IN SCOPE** (Inc 7) | P1 reliability. Windows path-length failures. |
| Refinement report | TD-128 DashboardsTab extraction | **Deferred** | Medium priority. Not blocking. Cycle 49+ |
| Refinement report | TD-23 InstallerWizardModal | **Deferred** | Low priority. Stable, runs once. Cycle 49+ |
| Refinement report | TD-127 Performance observability | **Deferred** | Requires dedicated PRD. Cycle 49+ |
| C47 deferred | PBI-ONB-016 Command Catalog | **Deferred** | Full Cycle 49 scope |
| C47 deferred | PBI-ONB-014 Configurable Startpage | **Deferred** | Cycle 49 scope |

### Scope Decision

This cycle is a **stabilization + spike** cycle: fix 2 bugs, resolve the highest-severity tech debt, complete a release blocker, address a security risk, and run a strategic spike on Bases integration. No new user-facing features beyond the bug fixes and the auto-truncating titles reliability improvement.

---

## Cycle Goals

1. **Fix Quick Capture YAML bug** — Sanitize or escape special characters in the description field to prevent YAML corruption
2. **Fix session note activity log bloat** — Persist only the aggregated activity log when saving session notes, not raw event entries
3. **Decompose session/helpers.ts** — Split 982 LOC into 5 focused modules (summaryGenerator, noteParser, templateHelpers, formatters, sessionUtils) with barrel re-export
4. **Complete Obsidian ESLint rules** — Implement marketplace-required ESLint rules for Obsidian plugin compliance (RB-2)
5. **Migrate Signal secrets to secure storage** — Move PAT storage from plain `data.json` to encrypted/secret storage pattern
6. **Bases integration spike** — Register one analytics view type as an Obsidian Bases view. Validate the integration path, document findings, and determine if a full cycle is warranted.
7. **Auto-truncating titles** — Truncate long note titles at creation to stay within OS path limits, continuing the full title inside the note body

---

## Scope

### In Scope

- **Quick Capture YAML fix**
  - Sanitize description field before writing to YAML frontmatter
  - Escape or quote special characters (colons, quotes, pipes, newlines)
  - Alternatively: write long descriptions to markdown body instead of frontmatter
  - Regression tests for special character inputs
- **Session note activity log fix**
  - Identify where raw event entries are included in session note output
  - Filter to aggregated log entries only (grouped by file, action counts)
  - Ensure `generateSessionSummary()` respects the aggregation
  - Regression tests for note content
- **TD-118: session/helpers.ts decomposition**
  - Split into 5 focused modules per TD-118 suggested fix:
    - `summaryGenerator.ts` (~300 LOC) — `generateSessionSummary()`, `generateSessionSummaryBody()`
    - `noteParser.ts` (~200 LOC) — `reverseParseSessionNotes()` and related parsing
    - `templateHelpers.ts` (~150 LOC) — session type templates, guiding questions
    - `formatters.ts` (~100 LOC) — `formatDuration()`, `formatTimestamp()`, time helpers
    - `sessionUtils.ts` (~200 LOC) — state machine helpers, validation, frontmatter builders
    - `helpers.ts` (~30 LOC) — barrel re-export for backwards compatibility
  - Split `helpers.test.ts` correspondingly into per-module test files
  - Zero behaviour changes — pure refactor
- **RB-2: Obsidian ESLint rules**
  - Research Obsidian marketplace ESLint policy and required rules
  - Implement rules in ESLint config
  - Fix any violations across codebase
  - Verify `npm run lint` passes with new rules
- **Signal secret storage migration**
  - Evaluate Obsidian secret storage patterns (community approaches, encryption options)
  - Migrate AzureDevOpsAdapter PAT storage from plain settings to secure storage
  - Ensure backward compatibility (migrate existing PATs on first load)
  - Update Signal configuration UI if needed
- **Bases integration spike**
  - Register one Flowti analytics view (e.g., table tile) as a Bases view type
  - Document: API surface, limitations, data flow, rendering constraints
  - Determine: effort for full integration, architectural impact, user value
  - Spike deliverable: working proof-of-concept OR documented decision to defer
- **Auto-truncating titles**
  - Detect title length exceeding safe path threshold (e.g., 200 chars)
  - Truncate filename, append full title as H1 in note body
  - Apply to Quick Capture, session note creation, and any `FileSystemClient.createFile()` path

### Out of Scope

- TD-128 DashboardsTab extraction (Cycle 49+)
- TD-23 InstallerWizardModal decomposition (Cycle 49+)
- TD-127 Performance observability (requires PRD)
- Command Catalog (Cycle 49)
- Configurable Startpage (Cycle 49)
- Signal v2 adapters — Jira, GitHub (Cycle 50)
- AI foundation (Cycle 51)
- New user-facing features beyond bug fixes and title truncation

---

## Increments

### Inc 1: Quick Capture YAML Sanitization (PBI-BUG-001)

**Goal:** Fix the Quick Capture YAML-breaking bug by sanitizing special characters in the description field.

**AC:**

- [ ] Description field with colons, quotes, pipes, newlines, and `#` characters does not break YAML
- [ ] Existing notes with valid descriptions are unaffected
- [ ] Quick Capture modal still saves correctly for normal text
- [ ] Regression tests cover: special characters, multiline, empty, and long descriptions
- [ ] `npm test` passes

---

### Inc 2: Session Note Activity Log Fix (PBI-BUG-002)

**Goal:** Ensure session note saves only include the aggregated activity log, not raw event-level entries.

**AC:**

- [ ] Saved session note contains only grouped activity (file path + action count)
- [ ] Raw event entries (`file.created`, `file.modified` individual events) are not present in saved note
- [ ] Aggregation matches what the UI displays in the Activity Log panel
- [ ] Regression tests for session note content with varying activity volumes
- [ ] `npm test` passes

---

### Inc 3: Session Helpers Decomposition (PBI-TD-118)

**Goal:** Split `session/helpers.ts` (982 LOC) into 5 focused modules with zero behaviour changes.

**AC:**

- [ ] `summaryGenerator.ts` contains all summary generation functions
- [ ] `noteParser.ts` contains all reverse parsing functions
- [ ] `templateHelpers.ts` contains all template and guiding question functions
- [ ] `formatters.ts` contains all duration/timestamp formatting functions
- [ ] `sessionUtils.ts` contains state machine helpers, validation, frontmatter builders
- [ ] `helpers.ts` is a barrel re-export (~30 LOC) — all existing imports continue to work
- [ ] Test files split correspondingly — each module has its own test file
- [ ] No behaviour changes — all 5,283+ existing tests pass unchanged
- [ ] TD-118 status updated to resolved
- [ ] `npm test` passes

---

### Inc 4: Obsidian ESLint Rules (PBI-RB-002)

**Goal:** Implement Obsidian marketplace ESLint rules and fix all violations.

**AC:**

- [ ] Obsidian marketplace ESLint policy researched and documented
- [ ] Required rules added to ESLint config
- [ ] All violations across codebase fixed
- [ ] `npm run lint` passes with new rules
- [ ] `npm run check` passes (lint + tsc)
- [ ] RB-2 status updated to resolved
- [ ] `npm test` passes

---

### Inc 5: Signal Secret Storage Migration (PBI-SIG-007)

**Goal:** Migrate Signal PAT storage from plain `data.json` to a secure storage pattern.

**AC:**

- [ ] PATs no longer stored in plain text in `data.json`
- [ ] Secure storage pattern implemented and documented
- [ ] Existing PATs migrated transparently on first load (no user action required)
- [ ] Signal configuration UI works with new storage
- [ ] Connection test passes with migrated PAT
- [ ] `npm test` passes

---

### Inc 6: Bases Integration Spike (PBI-SPK-001)

**Goal:** Validate whether Flowti analytics views can be registered as Obsidian Bases view types. Produce a working PoC or a documented decision to defer.

**AC:**

- [ ] Obsidian Bases plugin API explored and documented (capabilities, limitations, data flow)
- [ ] At least one Flowti view type registered as a Bases view (table tile preferred)
- [ ] PoC renders Flowti query results inside a Bases view context
- [ ] Findings documented: effort for full integration, architectural impact, user value
- [ ] Decision recorded: proceed (Cycle 49+) or defer with rationale
- [ ] Spike branch or ADR committed

---

### Inc 7: Auto-Truncating Titles (PBI-CAP-001)

**Goal:** Prevent Windows path-length failures by auto-truncating long note titles and preserving the full title in the note body.

**AC:**

- [ ] Titles exceeding safe path threshold are truncated in the filename
- [ ] Full original title preserved as H1 heading in the note body
- [ ] Truncation applies to: Quick Capture, session notes, and `FileSystemClient.createFile()`
- [ ] Truncation point is clean (word boundary, no partial words)
- [ ] Tests cover: normal titles (no truncation), boundary-length titles, very long titles, special characters
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (Quick Capture YAML) ── independent
Inc 2 (Session Note Activity Log) ── independent
Inc 3 (Session Helpers Decomposition) ── independent (pure refactor)
Inc 4 (Obsidian ESLint Rules) ── independent
Inc 5 (Signal Secret Storage) ── independent
Inc 6 (Bases Integration Spike) ── independent
Inc 7 (Auto-Truncating Titles) ── independent
```

**Execution order:** All increments are independent. Recommended order prioritizes bugs first, then debt, then release blocker, then security, then spikes:

Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6 → Inc 7

**Critical path:** None — all increments are parallelisable if needed.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YAML sanitization changes Quick Capture behaviour for edge cases | Medium | Extensive test matrix for special characters; preserve existing valid descriptions |
| Session note format change breaks reverse parsing | High | `reverseParseSessionNotes()` must handle both old (raw) and new (aggregated) formats during transition |
| Helpers decomposition introduces import path breakage | Medium | Barrel re-export in `helpers.ts` ensures all existing imports work unchanged |
| Obsidian ESLint rules require invasive codebase changes | Medium | Research rules first; if scope is too large, implement incrementally across cycles |
| No standard Obsidian Secret Storage API exists | High | Research community patterns; may need custom encryption or keytar-based approach. If no viable pattern exists, document and defer to Obsidian team. |
| Bases plugin API is too limited for Flowti views | Medium | This is a spike — if the API is insufficient, document findings and defer. Low cost either way. |
| Auto-truncation creates duplicate filenames | Low | Include hash suffix or counter for disambiguation |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Bugs fixed | 2 | |
| New tests | ~60 | |
| Post-cycle total tests | ~5,343 | |
| Post-cycle suites | ~226 | |
| Increments | 7 | |
| session/helpers.ts LOC after | ~30 (barrel) | |
| Tech debt resolved | TD-118, RB-2 | |
| Security risks resolved | Signal PAT storage | |
| Spike decisions | Bases integration: proceed/defer | |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| TD-128 DashboardsTab extraction | Medium priority. Not blocking. | Cycle 49+ |
| TD-23 InstallerWizardModal decomposition | Low priority. Stable, runs once per vault. | Cycle 49+ |
| TD-127 Performance observability | Requires dedicated PRD. | Cycle 49+ |
| PBI-ONB-016 Command Catalog | Full cycle scope — Cycle 49 primary feature. | Cycle 49 |
| PBI-ONB-014 Configurable Startpage | UX feature, Cycle 49 scope. | Cycle 49 |
| PBI-ANA-134 KPI Targets + RAG Status | Analytics enhancement, deferred from C44. | Cycle 50+ |
| Signal v2 adapters (Jira, GitHub) | Full cycle scope — Cycle 50. | Cycle 50 |
| AI Foundation | Full cycle scope — Cycle 51. | Cycle 51 |

---

## Definition of Ready (Pre-Cycle)

- [ ] Cycle 47 delivered — all tests green, no blocking bugs
- [ ] `npm test` passes (5,283 tests, 221 suites) — verified 2026-02-26
- [ ] Backlog refinement completed (2026-02-26) — 414 items triaged, 88 archived/merged, 54 promoted
- [ ] TD-118 decomposition plan documented — 5 target modules with LOC estimates
- [ ] Quick Capture YAML bug reproduced and root cause identified
- [ ] Session note activity log bloat confirmed in code
- [ ] Obsidian Bases plugin API documentation available
- [ ] Obsidian marketplace ESLint policy documented

## Definition of Done

### 1. All Increments Completed
- [ ] 7 increments delivered, all PBIs addressed
- [ ] 2 bugs fixed with regression tests
- [ ] TD-118 resolved (session/helpers.ts decomposed)
- [ ] RB-2 resolved (Obsidian ESLint rules implemented)
- [ ] Signal secret storage migrated
- [ ] Bases spike completed with decision documented
- [ ] Auto-truncating titles implemented

### 2. Quality Gates
- [ ] `npm test` passes — all tests green
- [ ] `npm run check` passes — no lint or type errors
- [ ] All new tests exercise the features they validate
- [ ] No test regressions

### 3. Architecture
- [ ] session/helpers.ts decomposed into 5 focused modules + barrel
- [ ] Signal PAT storage uses secure pattern
- [ ] Bases integration findings documented (ADR or spike report)

### 4. User Experience
- [ ] Quick Capture handles special characters without YAML corruption
- [ ] Session notes contain only aggregated activity log
- [ ] Long titles are auto-truncated with full title in note body

### 5. Release Readiness
- [ ] All tests pass (`npm test`)
- [ ] ESLint marketplace rules pass (`npm run lint`)
- [ ] No new security risks introduced
- [ ] Tech debt register updated (TD-118 resolved, RB-2 resolved)

---

## DoD Verification (vs Definition of Done (Cycle))

### 1. All Increments Completed
- [ ] Each increment satisfies its own DoD — all ACs checked off
- [ ] No increment left in partial state
- [ ] Deferred items documented

### 2. Build & Test Quality
- [ ] Build pipeline green — `npm test` passes
- [ ] Test count meets or exceeds target (~60 new)
- [ ] No test regressions
- [ ] No skipped tests introduced

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] All blocker findings resolved
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [ ] Tech debt register updated — TD-118 resolved, RB-2 resolved
- [ ] Release blockers updated — RB-2 closed
- [ ] Inbox items addressed — 2 bugs, 1 risk resolved

### 5. Documentation
- [ ] Bases spike findings documented (ADR or spike report)
- [ ] Signal secret storage pattern documented
- [ ] ESLint rules documented for future contributors

### 6. Cycle Plan Completion
- [ ] Frontmatter updated — actuals filled in
- [ ] Success metrics verified
- [ ] Deviations documented
- [ ] Risks reviewed

### 7. Cycle Retrospective
- [ ] What went well
- [ ] Deviations from plan
- [ ] Improvement backlog items
- [ ] Learnings

### 8. Inbox & Feedback Loop
- [ ] Inbox items reviewed
- [ ] New feedback captured
- [ ] Next cycle inputs identified

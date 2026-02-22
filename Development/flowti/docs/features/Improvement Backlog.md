---
type: ImprovementBacklog
date_created: 2026-02-22
last_updated: 2026-02-22
cycle: 16
total_items: 32
scored_items: 32
---

# Improvement Backlog

Structured inventory of remaining improvement work, scored and prioritized for future cycle planning. Created during [[Cycle 16 - Improvement Sprint]] Inc 8.

## Release Readiness Assessment

**Overall:** 85% ready for submission (RB-1 is the sole remaining blocker).

| Area | Status | Notes |
|---|---|---|
| Code quality | PASS | ESLint, no innerHTML, safe DOM, no @ts-ignore |
| Submission compliance | PASS | Full audit passed (Inc 6) |
| Error handling | PASS | ADR-036 convention, 85+ catches audited (Inc 3) |
| Test coverage | STRONG | 3,600 tests, 147 suites, 16 flow tests |
| Repository structure | BLOCKED | RB-1: manifest.json not at repo root |
| Feature completeness | HIGH | 5 of 7 PRDs at FRI ≥ 30/35 |

**The one remaining blocker:** Repository restructure (RB-1). Plugin source lives at `Development/flowti/` within an Obsidian vault. Obsidian Community Plugins require `manifest.json` at the repo root. See [[ADR-035 Repository Restructure Proposal]] for migration plan.

## Area 1: Release Readiness

| # | Item | Severity | Effort | User Impact | Recommended |
|---|---|---|---|---|---|
| R-1 | Repository restructure (RB-1) — move build config to repo root | Blocker | High (1 cycle) | Critical | Cycle 17 or dedicated sprint |
| R-2 | GitHub release automation — tag matching, main.js + manifest.json in release | Medium | Medium | High | Post-restructure |
| R-3 | Plugin description — action verb start, better marketplace positioning | Low | Trivial | Medium | Pre-submission |
| R-4 | fundingUrl in manifest — optional but recommended | Info | Trivial | Low | Pre-submission |
| R-5 | setHeading() for settings sections — semantic improvement over createEl("h3") | Info | Low | Low | Backlog |
| R-6 | versions.json — verify version history matches releases | Low | Trivial | Low | Pre-submission |

## Area 2: Quality & Stability

| # | Item | Severity | Effort | User Impact | Recommended |
|---|---|---|---|---|---|
| Q-1 | Real Azure DevOps API validation (C11-OBS-1) | High | Medium | High | Pre-release of Signal feature |
| Q-2 | Large canvas performance testing (C15-OBS-3) | Medium | Low | Medium | Backlog |
| Q-3 | HTML→MD converter improvement for ADO (C11-OBS-2) | Medium | Medium | Medium | Backlog |
| Q-4 | 38 open tech debt items (see TD inventory) | Mixed | Mixed | Mixed | Ongoing |
| Q-5 | TD-06: UI layer bypasses EventBridge | Medium | High | Low | Backlog |
| Q-6 | TD-12: Wildcard listeners degrade performance | Medium | Medium | Low | Backlog |
| Q-7 | TD-28: Scanner duplication between Catalog and Hub | Low | Medium | Low | Backlog |
| Q-8 | TD-48: CSV parsing blocks UI thread | Medium | Medium | High | Next feature cycle |
| Q-9 | TD-69: Import runs sequentially | Low | Medium | Medium | Backlog |
| Q-10 | TD-118: session helpers.ts exceeds 600 LOC | Low | Medium | Low | Backlog |
| Q-11 | TD-44: No list virtualization | Medium | High | High | Backlog |

## Area 3: Polish & UX

| # | Item | Severity | Effort | User Impact | Recommended |
|---|---|---|---|---|---|
| P-1 | Signal Configuration Wizard (C11-OBS-3) — replace inline form | Low | Medium | Medium | Backlog |
| P-2 | Canvas Action View extraction if 3rd ItemView appears (C15-OBS-1) | Low | Medium | Low | Monitor |
| P-3 | EventBus domain-scoped listeners (C15-OBS-4) | Low | High | Low | Backlog |
| P-4 | Quick Capture PRD (FRI 27/35) — needs 3 more points | Medium | Medium | High | Cycle 17-18 |
| P-5 | Domain Design Session UI pattern (ADR-030) | Low | High | Medium | Backlog |
| P-6 | 56 discovery-stage inbox items (see inbox inventory) | Mixed | Mixed | Mixed | Ongoing triage |
| P-7 | PBI-SW-009 scope decision (C9-OBS-1) | Medium | Low | Medium | Next session cycle |

## Area 4: Documentation

| # | Item | Severity | Effort | User Impact | Recommended |
|---|---|---|---|---|---|
| D-1 | TD-78: Domain documents are empty stubs | Low | Medium | Medium | Backlog |
| D-2 | TD-83: Only 1 of 28 features has problem-solution separation | Low | High | Low | Backlog |
| D-3 | TD-87: Knowledgebase has only 2 articles | Low | Medium | Medium | Backlog |
| D-4 | TD-24: AGENTS.md source tree outdated | Low | Low | Low | Backlog |
| D-5 | TD-119: Documentation stats drift across README/AGENTS/CHANGELOG | Low | Low | Low | Backlog |

## Scoring Legend

- **Severity:** Blocker > High > Medium > Low > Info
- **Effort:** High (1+ cycles) > Medium (1 increment) > Low (hours) > Trivial (minutes)
- **User Impact:** Critical (blocks release) > High (users notice) > Medium (power users) > Low (internal)
- **Recommended:** Specific cycle > "Next X cycle" > "Backlog" > "Monitor"

## Metrics Snapshot

| Metric | Value |
|---|---|
| Total tests | 3,600 |
| Test suites | 147 |
| Source files | ~230 |
| ADRs | 36 |
| Tech debt: open | 38 |
| Tech debt: resolved | 76 |
| Inbox: discovery | 56 |
| PRDs at FRI ≥ 30 | 5 of 7 |
| Three Amigos observations open | 14 |
| Release blockers open | 1 (RB-1) |
| Submission compliance | PASS |

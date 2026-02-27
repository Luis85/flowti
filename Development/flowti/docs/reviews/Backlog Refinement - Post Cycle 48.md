---
type: BacklogRefinement
date: 2026-02-27
stage: done
description: "Strategic backlog refinement establishing 5 Release Anchor Themes for Cycles 49–55"
pre_review_tests: 5315
pre_review_suites: 222
open_tech_debt: 32
inbox_items_vault: 85
inbox_items_plugin: 64
release_blockers_open: 2
release_blockers_resolved: 6
---

# Backlog Refinement — Post Cycle 48

## Session Summary

Strategic backlog refinement conducted after Cycle 48 (Stabilize and Strategic Spike). This review analyzed **32 open tech debt items**, **149 inbox items** (85 vault + 64 plugin), **21 domain maturity levels**, and the full project trajectory across 48 cycles to determine where to invest next.

**Key Decision**: Establish **5 Release Anchor Themes** that guide prioritization from Cycle 49 through Cycle 55 — a structured path from current state to marketplace-ready release with proven dogfooding.

**Strategic Cut**: Signal v2 (Jira, GitHub adapters) is **deferred** beyond Cycle 55. The existing Azure DevOps adapter must be hardened and end-to-end tested before expanding to new integrations. We improve what we have before we add what we don't.

---

## Current State Assessment

### Health Snapshot

| Metric | Value |
|--------|-------|
| Tests | 5,315 passing (222 suites) |
| Domains | 21 (4 mature, 9 stable, 7 basic, 1 infrastructure) |
| Open Tech Debt | 32 items (5 high, 16 medium, 10 low severity) |
| Inbox Items | 149 total (85 vault, 64 plugin) |
| Release Blockers | 2 open (RB-6: CLI Installer, RB-7: Pipeline Merge) |
| TASM Score | 34/35 (Cycle 48) |
| Source Files | 230+ |
| Service LOC | ~11,000 across 21 domains |

### Domain Maturity

**Tier 1 — Highly Mature** (4 domains):
- Analytics (828 LOC service, 989 LOC engine, 750+ tests)
- Train (1,049 LOC, canvas writer + sync, 350+ tests)
- Session (613 LOC, 6-state machine, 6 handler modules, 400+ tests)
- Data Exchange (1,846 LOC across 4 services, 200+ tests)

**Tier 2 — Stable** (9 domains):
- Inbox, Ingestion, Settings, Canvas, Installer, Event Definition, Docs, User, Signal

**Tier 3 — Basic** (7 domains):
- Discovery, Subscription, Onboarding, Nudge, EventFilter, EventNotify, Capture

**Tier 4 — Infrastructure** (1 domain):
- Hub (registry pattern, no traditional service)

### Cycle 48 Outcomes

Cycle 48 was a strong stabilization round delivering 8 increments (5 planned + 3 unplanned CSS):
- 2 critical bugs fixed (YAML sanitization, session log bloat)
- TD-118 resolved (session/helpers.ts 982 → 5 modules + 26 LOC barrel)
- RB-2 resolved (ESLint Obsidian marketplace compliance)
- SecretStore migration (Signal PATs → encrypted storage)
- CSS architecture: monolithic styles.css → 12 layered source files
- Inline style migration: 1,724 warnings → 0

### Release Blocker Status

| RB | Title | Status | Resolved |
|----|-------|--------|----------|
| RB-1 | Repository restructure → Versioned folder config | RESOLVED | C46 |
| RB-2 | ESLint Obsidian marketplace compliance | RESOLVED | C48 |
| RB-3 | Canvas Import | RESOLVED | C15 |
| RB-4 | Seed Starter Content | RESOLVED | C45 |
| RB-5 | External Data Ingestion | RESOLVED | C11 |
| RB-6 | CLI Installer | OPEN | — |
| RB-7 | Pipeline Multi-Source Merge | OPEN | — |
| RB-8 | Documentation Stubs | RESOLVED | C48 |

**Assessment**: RB-6 is a nice-to-have for v1 (installer wizard works). RB-7 is a power-user feature that can ship in v1.1. Neither blocks marketplace submission.

---

## Open Tech Debt Analysis

### By Severity

| Severity | Count | Key Items |
|----------|-------|-----------|
| High | 5 | TD-49 (layout abstraction), TD-50 (workspace shell), TD-52 (declarative tabs), TD-78 (domain docs empty), TD-06 (UI bypasses EventBridge) |
| Medium | 16 | TD-127 (perf observability), TD-128 (DashboardsTab 1,149 LOC), TD-121 (session handler tests), TD-90 (manual event catalog), TD-92 (no PR process), TD-119 (stats drift) |
| Low | 10 | TD-12 (wildcard perf), TD-23 (installer modal), TD-44 (virtualization), TD-48 (CSV parsing), TD-87 (knowledge base) |

### By Category

| Category | Count | Key Items |
|----------|-------|-----------|
| Architecture/Foundation | 5 | TD-49, TD-50, TD-51, TD-52, TD-42 |
| Documentation | 8 | TD-24, TD-78, TD-81, TD-83, TD-87, TD-90, TD-92, TD-119 |
| Testing | 3 | TD-30, TD-57, TD-121 |
| Performance | 6 | TD-12, TD-36, TD-44, TD-48, TD-58, TD-66, TD-69 |
| UX/Features | 7 | TD-23, TD-28, TD-38, TD-43, TD-45, TD-47, TD-59, TD-60, TD-77 |
| Code Quality | 3 | TD-53, TD-73, TD-120 |

### Critical Path

1. **Hub Framework**: TD-49 → TD-50 → TD-51 → TD-52 (sequential dependency chain)
2. **Performance**: TD-127 (observability) must precede optimization work (TD-12, TD-44, TD-48, TD-66, TD-69)
3. **Documentation**: TD-78 (domain docs) + TD-87 (knowledge base) + TD-90 (auto-generation) form a documentation pipeline
4. **Release Process**: TD-92 (PR process) + TD-119 (stats drift) are pre-release hygiene

---

## Inbox Analysis

### Volume & Distribution

| Source | Items | Top Categories |
|--------|-------|----------------|
| Vault Inbox | 85 | Session/Workflow (15), AI/Visualization (16), Process/Knowledge (18), Data Quality (12) |
| Plugin Inbox | 64 | Session Features (22), Data Exchange (18), Automation (16), Infrastructure (10) |

### Recurring Themes (across both inboxes)

1. **Canvas Integration** — Multiple items with detailed 6-phase implementation plan
2. **Session Enhancement** — Guided tours, quality gates, checklists, AI-assisted sessions
3. **Data Pipeline Maturity** — Multi-source merge, step preview, trending, conformance scripts
4. **Dogfooding** — Flowti managing Flowti development, auto-documentation, report ingestion
5. **Automation** — File routing, bulk updates, type prompts, nudges
6. **Documentation** — Auto-generation, traceability, keeping docs current from source
7. **Habit Formation** — Nudges, ceremonies, closure rituals, backlog refinement reminders

### Release Blockers in Inbox

| RB | Title | Priority | Decision |
|----|-------|----------|----------|
| RB-6 | CLI Installer | Discovery | Defer — wizard works for v1 |
| RB-7 | Pipeline Multi-Source Merge | High | Cycle 53 — power-user feature for v1.1 |

### Promoted Items (P1 — Next Cycles)

- PBI-ONB-016: Command Catalog
- PBI-ONB-014: Configurable Startpage
- PBI-009: Ingest build/test/coverage reports as vault notes
- PBI-006: Auto-route inbox files by type
- PBI-008: Import/export execution timing
- PBI-CAN-003: Canvas Sessions
- PBI-CAN-002: Canvas template library
- TD-128: DashboardsTab decomposition
- TD-121: Session handler dedicated tests
- TD-119: README/AGENTS/CHANGELOG stats update

---

## Release Anchor Themes

Five strategic themes anchor all prioritization from Cycle 49 through Cycle 55. Each theme represents a distinct investment area with clear value delivery.

### Theme 1: Ship It — Release Path

**Value**: Get real users, real feedback, stop polishing in isolation.

| Item | Type | Effort | Cycle |
|------|------|--------|-------|
| Decide RB-6/RB-7 scope (cut or defer to v1.1) | Decision | Tiny | 49 |
| TD-119: README/CHANGELOG/AGENTS stats update | Tech Debt | Small | 49 |
| TD-92: Lightweight PR process + branch protection | Tech Debt | Medium | 55 |
| TD-78: Domain documentation completion | Tech Debt | Medium | 55 |
| TD-81: User story content completion | Tech Debt | Medium | 55 |
| Final release preparation checklist | Process | Medium | 55 |

**Rationale**: The plugin is technically marketplace-ready after C48 (ESLint clean, 5k+ tests, security hardened). The remaining work is documentation, process, and first-impression polish.

### Theme 2: Dogfooding — Flowti Builds Flowti

**Value**: Prove the product by using it. Every gap discovered is a gap users would hit.

| Item | Type | Effort | Cycle |
|------|------|--------|-------|
| PBI-009: Ingest build/test/coverage reports as vault notes | Feature | Medium | 49 |
| Backlog refinement nudge | Feature | Small | 49 |
| Auto-generate cycle reports after each executed cycle | Feature | Medium | 51 |
| Idea-to-solution traceability (inbox → delivered feature) | Feature | Large | 51 |
| Auto-document commands from registered palette entries | Feature | Medium | 51 |
| TD-90: Event Catalog + Data Dictionary auto-generation | Tech Debt | Large | 51 |

**Rationale**: The development process itself becomes the showcase. If Flowti can't track its own lifecycle, it can't track anyone else's.

### Theme 3: User Activation — First 5 Minutes

**Value**: Retention. If a new user can't get value in 5 minutes, nothing else matters.

| Item | Type | Effort | Cycle |
|------|------|--------|-------|
| PBI-ONB-016: Command Catalog (browsable, grouped by domain) | Feature | Large | 50 |
| PBI-ONB-014: Configurable Startpage | Feature | Medium | 50 |
| TD-87: Knowledge base expansion (10+ tutorials) | Tech Debt | Medium | 50 |
| User Hub idea capture section | Feature | Small | 50 |
| Quick capture configuration (per-command folder, template) | Feature | Medium | 50 |

**Rationale**: The onboarding domain is Tier 3 (basic). Only 2 knowledge base articles exist. The install-to-aha journey needs deliberate investment.

### Theme 4: Feature Deepening — Competitive Moat

**Value**: Differentiation. What makes Flowti irreplaceable vs. generic tools?

| Item | Type | Effort | Cycle |
|------|------|--------|-------|
| Signal Azure DevOps hardening (error handling, retry, diagnostics) | Hardening | Medium | 54 |
| RB-7: Pipeline multi-source merge | Feature | Large | 53 |
| PBI-008: Import/export execution timing | Feature | Small | 53 |
| TD-69: Import concurrency (JobQueue reuse) | Tech Debt | Medium | 53 |
| PBI-CAN-003: Canvas Sessions | Feature | Large | 54 |
| PBI-CAN-002: Canvas template library | Feature | Medium | 54 |
| PBI-006: Auto-route inbox files by type | Feature | Medium | 54 |

**Strategic Cut**: Signal v2 (Jira, GitHub adapters) is deferred beyond C55. The existing Azure DevOps adapter must be hardened, tested end-to-end, and proven reliable before expanding scope. We improve what we have before we add what we don't.

### Theme 5: Architecture — Invest in the Platform

**Value**: Future velocity. Pay now, move faster later.

| Item | Type | Effort | Cycle |
|------|------|--------|-------|
| TD-128: DashboardsTab decomposition (1,149 LOC) | Tech Debt | Medium | 49 |
| TD-121: Session handler dedicated tests (6 modules) | Tech Debt | Medium | 49 |
| TD-49: Layout abstraction layer | Tech Debt | Large | 52 |
| TD-50: Workspace shell layout | Tech Debt | Large | 52 |
| TD-51: Component registry and manifest | Tech Debt | Medium | 52 |
| TD-127: Performance observability (perf.* events) | Tech Debt | Medium | 52 |

**Rationale**: The Hub Framework chain (TD-49→50→51→52) is the highest-severity architecture debt. Performance observability (TD-127) must precede any optimization work.

---

## Proposed Cycle Roadmap (49–55)

| Cycle | Theme | Focus | Key Deliverables |
|-------|-------|-------|------------------|
| **49** | Ship It + Dogfooding | Release readiness, prove the product | Stats update, report ingestion, TD-128, TD-121, refinement nudge |
| **50** | User Activation | First 5 minutes | Command Catalog, configurable startpage, knowledge base, idea capture |
| **51** | Dogfooding Deep | Flowti builds Flowti | Cycle report generation, traceability, command docs, TD-90 auto-generation |
| **52** | Architecture | Platform foundation | Hub framework (TD-49, TD-50, TD-51), performance observability (TD-127) |
| **53** | Feature Deepening | Data Exchange evolution | RB-7 pipeline merge, import concurrency, execution timing, CSV streaming |
| **54** | Feature Deepening | Canvas & Signal hardening | Canvas Sessions, template library, Signal ADO hardening, inbox auto-routing |
| **55** | Ship It | Release gate | PR process, domain docs, user stories, final QA, release checklist |

### Cycle Cadence

- **Cycles 49–50**: User-facing value (ship readiness + activation)
- **Cycles 51–52**: Internal investment (dogfooding + architecture)
- **Cycles 53–54**: Feature deepening (data + canvas + signal)
- **Cycle 55**: Release gate (quality, docs, process)

---

## Deferred Beyond Cycle 55

The following items are explicitly **out of scope** for Cycles 49–55:

| Item | Reason |
|------|--------|
| Signal v2 (Jira, GitHub adapters) | Harden existing ADO adapter first |
| AI Foundation (LLM integration) | Market table-stakes but premature without stable platform |
| Bases Integration (Obsidian 1.10) | Spike deferred twice; revisit when Bases API stabilizes |
| TD-52: Declarative tab definition | Depends on TD-49/50/51; earliest C52 stretch goal |
| E2E test foundation | Blocked on Obsidian CLI availability |
| Mobile support | Out of scope for v1 |
| Collaboration/multiplayer | Out of scope entirely |

---

## Strategic Positioning

### What Makes Flowti Unique
- **Event-driven business modeling** in a local-first environment
- **DDD architecture** with 21 bounded contexts and typed EventBus
- **Canvas-first workflows** for visual domain modeling
- **Measurement lifecycle** (query → dashboard → tile → filter → drill-down)
- **Integrated development engine** (idea → qualification → execution → reflection)

### Where We Invest (C49–55)
- **Discoverability** (C50): Command Catalog, Startpage, Knowledge Base
- **Reliability** (C49, C54): Signal hardening, session tests, stats accuracy
- **Self-proof** (C49, C51): Dogfooding as the primary validation strategy
- **Platform velocity** (C52): Hub Framework foundation for future features
- **Data maturity** (C53): Pipeline merge, concurrency, timing

### Where We Do NOT Invest (C49–55)
- New integrations (Jira, GitHub) — harden existing first
- AI features — premature without stable platform
- Mobile — not in scope for v1
- Publishing/export — existing export works; no Astro/web publishing
- Collaboration — local-first is the bet

---

## Next Steps

1. **Cycle 49 Planning**: Begin immediately with Ship It + Dogfooding theme
2. **Inbox Hygiene**: Archive 88 items identified in C48 triage (already done)
3. **Memory Update**: Update `memory/MEMORY.md` and `memory/cycle-history.md` after each cycle
4. **Theme Tracking**: Each cycle's Three Amigos Review should reference its Release Anchor Theme
5. **Mid-roadmap Review**: After Cycle 52, reassess remaining themes against user feedback

---

## Related

- [[Backlog Refinement - Post Cycle 47]]
- [[Cycle 48 - Stabilize and Strategic Spike]]
- [[Review — 00-Connectivity Audit]]
- [[backlog-refinement-2026-02-22]]

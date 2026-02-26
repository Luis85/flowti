# Backlog Refinement Report — Post Cycle 47

**Date**: 2026-02-26
**Last Cycle**: Cycle 47 — Onboarding Phase 2
**Test Health**: 5,283 tests | 221 suites | all passing
**Tech Debt**: 128 tracked (38 open, 90 resolved/mitigated)

---

## 1. Inbox Triage Summary

| Source | Total | Archive | Promote | Refine | Park | Merge |
|--------|-------|---------|---------|--------|------|-------|
| Vault inbox | 305 | 27 | 38 | 71 | 149 | 20 |
| Plugin inbox | 109 | 36 | 16 | 30 | 22 | 5 |
| **Combined** | **414** | **63** | **54** | **101** | **171** | **25** |

**Immediate action**: 63 items can be archived (delivered/fixed/duplicate). 25 items should be merged into existing items. This alone reduces the active backlog from 414 to 326 items.

### Promoted Items by Priority

| Priority | Count | Focus |
|----------|-------|-------|
| P1 (next cycle) | 10 | Bugs, release blockers, security |
| P2 (soon) | 32 | UX improvements, command catalog, nudges, dashboard export |
| P3 (later) | 12 | Train enhancements, session polish, JSON visualization |

### Theme Distribution (PROMOTE + REFINE = active backlog)

| Theme | Promote | Refine | Total | Market Signal |
|-------|---------|--------|-------|---------------|
| Canvas & Train | 4 | 18 | 22 | Medium — workflow visualization is trending |
| User Experience | 10 | 5 | 15 | High — discoverability is an adoption barrier |
| Analytics & Dashboards | 4 | 8 | 12 | High — Bases disruption, dashboard export gap |
| Process & Habits | 3 | 8 | 11 | Medium — nudges/reminders unique to Flowti |
| Vault & Content Management | 6 | 4 | 10 | Medium — bulk ops and data quality |
| Infrastructure & Architecture | 5 | 4 | 9 | High — release blockers live here |
| Documentation & Knowledge | 3 | 5 | 8 | Low — internal quality, not user-facing |
| Session & Workflow | 3 | 8 | 11 | Medium — session maturity is a differentiator |
| Data Exchange & Pipelines | 1 | 8 | 9 | Medium — pipeline evolution |
| Installer & Onboarding | 2 | 5 | 7 | High — first impression drives adoption |
| Signal & Integrations | 2 | 1 | 3 | Critical — single-source is the biggest market gap |
| AI & Intelligence | 0 | 3 | 3 | Critical — every competitor is shipping AI |

---

## 2. Market Research Insights

### Competitive Landscape

Flowti occupies a **unique intersection** no single tool replicates:

```
Local-First Knowledge Management (Obsidian)
  + Event-Driven Integration Architecture (EventBus + Signal)
  + Analytics Dashboard Builder (Queries, Tiles, Charts, KPIs)
  + Canvas-Based Workflow Visualization (Train)
```

**Closest competitors by domain**:
- **Agile Task Notes** (Obsidian): Jira + Azure DevOps sync — matches Signal but no analytics, no events
- **Notion/Coda**: All-in-one workspace — cloud-only, no event architecture, no local-first
- **Linear/Plane**: Developer PM — fast but no knowledge management, no dashboards
- **Huly**: Open-source Jira+Linear+Notion — early-stage, no Obsidian, no event bus
- **Retool/Appsmith**: Internal tools — dashboard builders, no knowledge management

### Key Market Signals

1. **The Projects plugin void**: Discontinued, community explicitly asking for replacement. Flowti can claim this space.
2. **Obsidian Bases (1.10)**: Core plugin with plugin API for custom view types. Opportunity to integrate, not compete.
3. **AI is table stakes**: 84% of developers use or plan to use AI daily. Notion AI, ClickUp Brain, Copilot for Obsidian are setting expectations.
4. **Platform engineering boom**: 80% of engineering orgs will have platform teams by 2026. "Personal developer platform" is a compelling positioning.
5. **50% of developers lose 10+ hours/week** to organizational overhead. Unified context tools are in high demand.

### Three Strategic Gaps

| Gap | Severity | Opportunity |
|-----|----------|-------------|
| **No AI integration** | Critical | Event-aware AI is architecturally impossible for competitors. NL→query builder, session intelligence, signal enrichment. |
| **Azure DevOps only** | Critical | Agile Task Notes already does Jira+AzDO. Adding Jira and GitHub adapters triples addressable market. |
| **No Bases integration** | High | Registering analytics views as Bases view types deeply integrates with core Obsidian. Low effort, high ecosystem signal. |

---

## 3. Open Tech Debt (Top 10 by Impact)

| ID | Item | LOC | Severity | Theme |
|----|------|-----|----------|-------|
| TD-118 | `session/helpers.ts` monolith | 982 | HIGH | Largest file in codebase, 5 mixed concerns |
| TD-128 | `DashboardsTab.ts` callback sprawl | 1,149 | MEDIUM | Dual maintenance with AnalyticsDashboardPage |
| TD-23 | `InstallerWizardModal` mixed concerns | 774 | LOW* | Grew 200 LOC in C47 despite extraction |
| TD-127 | No performance observability | — | MEDIUM | No instrumentation for data.json, startup, queries |
| TD-90 | Event Catalog manually maintained | 330+ events | MEDIUM | No automation to sync code → docs |
| TD-43 | No correlation IDs in events | — | MEDIUM | Traceability gap for debugging |
| TD-78-89 | Empty/stub documentation | 12 items | LOW | Inconsistent docs, hard to onboard contributors |
| TD-06 | UI bypasses EventBridge | 112 calls | LOW* | All read-only — acceptable trade-off |
| TD-69 | Import runs sequentially | — | LOW | No concurrency for large datasets |
| TD-48 | CSV parsing blocks UI thread | — | LOW | Acceptable at current data sizes |

*TD-23 reclassified to LOW because the modal runs once per vault and is stable.

---

## 4. Release Blockers

| ID | Item | Status | Priority |
|----|------|--------|----------|
| RB-1 | Versioned JSON installer config | Planned | CRITICAL |
| RB-2 | Obsidian ESLint rules | In-progress | CRITICAL |
| RB-7 | Pipeline multi-source merge | Planned | HIGH |
| — | Signal secret storage (Obsidian Secret API) | Open | HIGH |
| — | Quick Capture YAML-breaking bug | Open | HIGH |
| — | E2E test foundation | Blocked (Obsidian CLI) | HIGH |
| — | File/folder restructure for marketplace | In-progress | HIGH |

---

## 5. Deferred Items from Recent Cycles

### From Cycle 47 (Onboarding Phase 2)
- PBI-ONB-014: Configurable start page
- PBI-ONB-015: Role-specific seed data packs
- PBI-ONB-016: Command catalog
- PBI-ONB-018: Guided tours
- Project Manager seed content
- TD-23 decomposition

### From Cycle 44 (Analytics PRD v19)
- PBI-ANA-134: KPI targets + RAG status
- PBI-ANA-135: Goal lines on charts
- PBI-ANA-136: Dashboard PDF export
- PBI-ANA-137: Dashboard Markdown export
- TD-127: Performance observability
- TD-128: DashboardsTab extraction

### Signal Domain v2 (deferred since Cycle 11)
- Push/write-back to external systems
- Auto-sync scheduling
- Multiple workspace support
- Jira adapter
- GitHub adapter

---

## 6. Recommended Cycle Priorities

### Cycle 48: Stabilize + Strategic Spike

**Rationale**: After two onboarding cycles, consolidate quality and run strategic spikes that inform the roadmap.

**Must-do (P1)**:
1. **Fix Quick Capture YAML bug** — data corruption risk, fast fix
2. **Fix session note activity log bloat** — notes growing unbounded
3. **TD-118: Decompose session/helpers.ts** — 982 LOC → 5 modules. Largest maintenance risk.
4. **RB-2: Complete Obsidian ESLint rules** — release blocker, already in-progress
5. **Signal secret storage migration** — security risk, use Obsidian Secret API

**Should-do (P2)**:
6. **Bases integration spike** — register one analytics view as a Bases view type. Small effort, validates the integration path. Signals ecosystem alignment.
7. **Auto-truncating titles** — Windows path-length bug prevention. Directly impacts reliability.

**Target**: 5-7 increments, mixed bugs/debt/spike

---

### Cycle 49: Command Catalog + UX Polish

**Rationale**: Discoverability is the #1 adoption barrier. Users can't find what Flowti can do.

**Scope**:
1. **PBI-ONB-016: Command catalog** — browsable catalog of all Flowti commands grouped by domain. Acts as in-app user manual.
2. **Command palette as single source of truth** — all flows must be command-triggerable
3. **User Hub layout reorder** — title, session callout, inbox, quick actions, hubs
4. **Quick capture config** — per-command target folder and template
5. **Configurable start page** (PBI-ONB-014)

**Target**: 8-10 increments, UX-focused

---

### Cycle 50: Signal Domain v2

**Rationale**: Single-source integration is the biggest market gap. Every competitor syncs multiple tools. The adapter pattern in SignalService was designed for this.

**Scope**:
1. **Jira adapter** — largest PM tool market share, most requested
2. **GitHub adapter** — natural fit for developer audience
3. **Signal secret storage** — prerequisite (if not done in C48)
4. **Connection management UI improvements**
5. **Auto-sync scheduling** (if time permits)

**Target**: 10-12 increments, feature-focused

---

### Cycle 51: AI Foundation

**Rationale**: AI is the single largest competitive gap. But Flowti has a unique advantage: the EventBus backbone enables event-aware AI that no competitor can replicate.

**Scope**:
1. **AI service foundation** — provider-agnostic (Ollama local, OpenAI/Anthropic cloud)
2. **Natural language → analytics query** — "Show me items blocked more than 3 days" → Flowti query
3. **Session intelligence** — pattern analysis from session lifecycle data
4. **AI-assisted Quick Capture classification** — auto-type and auto-route notes

**Target**: 8-10 increments, spike→foundation→feature

---

### Cycle 52+: Canvas Sessions + Data Exchange Evolution

**Scope (Canvas)**:
- PBI-CAN-003: Canvas session workspace
- PBI-CAN-002: Canvas template library
- Train type selection at start
- Session completion view adjustments for trains

**Scope (Data Exchange)**:
- RB-7: Pipeline multi-source merge
- Pipeline step preview with intermediate views
- Import execution timing (PBI-008)
- Data pipeline conformance scripts

---

## 7. Inbox Hygiene — Executed 2026-02-26

### Completed Actions

| Action | Plugin Inbox | Vault Inbox | Total |
|--------|-------------|-------------|-------|
| Archived (delivered/fixed/duplicate) | 36 | 27 | 63 |
| Merged (into parent items) | 5 | 20 | 25 |
| **Total items removed from active inbox** | **41** | **47** | **88** |

### Post-Hygiene Inbox State

| Inbox | Before | After | Reduction |
|-------|--------|-------|-----------|
| Plugin inbox | 109 | 68 | -38% |
| Vault inbox | 386 | 339 | -12% |
| **Combined** | **495** | **407** | **-18%** |

All archived items moved to `inbox/archive/` in their respective locations.
Merged items have `> [!merged]` callouts appended to the surviving parent item before archival.

### Remaining Actions (manual)

1. **Move 54 PROMOTE items to proper backlog** with PBI numbers
2. **Tag 101 REFINE items** with their theme for future discovery

### Recurring (every 2 cycles)

- Review PARK items (171) for relevance changes
- Promote REFINE items that gained clarity during development
- Archive items that became irrelevant due to architectural changes

---

## 8. Strategic Positioning Summary

### What Makes Flowti Unique
- **Event-driven backbone** — no other Obsidian plugin or competing tool has this
- **Local-first + integrations** — bridges the gap between data sovereignty and tool connectivity
- **Domain-driven architecture** — extensible by design, not bolted-on features
- **Canvas workflows** — visual process design unique to Obsidian ecosystem
- **Measurement lifecycle** — definition → query → dashboard → KPI in one tool

### Where to Invest
1. **Discoverability** (Cycle 49) — users can't adopt what they can't find
2. **Multi-source integration** (Cycle 50) — break out of single-source limitation
3. **AI** (Cycle 51) — meet market expectations, leverage unique EventBus advantage
4. **Bases integration** (Cycle 48 spike) — align with Obsidian core, not compete with it

### Where NOT to Invest (Yet)
- Mobile (Flowti is a power-user tool; mobile dilutes focus)
- Collaboration/multiplayer (solo-user is the current strength; team features need infrastructure)
- Publishing/Astro/external sharing (solve internal value first)
- Full E2E testing (blocked on Obsidian CLI; monitor, don't force)

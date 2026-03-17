---
type: CycleSequenceReview
date: 2026-02-20
scope: "Revised cycle sequence — prioritize Azure DevOps Integration, reassess Cycles 9–13"
trigger: "User request to prioritize Azure DevOps Integration after backlog refinement 2026-02-20"
---

# Cycle Sequence Review — Azure DevOps Prioritization

## 1. Context

Following the backlog refinement of 2026-02-20, the product owner has requested **Azure DevOps Integration be elevated to a near-term priority**. The refinement had placed Azure DevOps under "Deferred (low priority, vision)" as part of the Signals feature. This review re-evaluates the planned cycle sequence to accommodate this strategic shift.

### Current Planned Sequence (Before This Review)

| Cycle | Theme | Stage | Key Items |
|-------|-------|-------|-----------|
| 9 | SessionService Extraction & Intelligence | Planned | TD-101, TD-100, PBI-SW-015 |
| 10 | Refactoring & Technical Debt Cleanup | Planned | 28 TD items across 6 increments |
| 11 | Release Preparation | Defined (refinement) | RB-1, RB-3, RB-4, RB-7, Quick Capture, BRAT |
| 12 | Canvas Sessions & Dogfooding | Defined (refinement) | Canvas workspace, templates, auto-docs |

### Azure DevOps Position Before This Review

- **5 inbox items** across both inboxes (all at `discovery` / `0-low` priority)
- Categorized under "Deferred (low priority, vision)" in the priority sequence
- Architectural home: "Signals" — a new integration framework for the Data Exchange Hub
- Addresses **RB-5**: "No external data ingestion"

---

## 2. Strategic Analysis

### Why Azure DevOps Integration Matters Now

1. **RB-5 Release Blocker** — "No external data ingestion" is a release blocker. CSV-only import limits the plugin to manual data entry. Azure DevOps is the first real-world integration that proves the system can ingest live project data.

2. **Dogfooding Enabler** — The project itself uses Azure DevOps. Eating your own dog food by pulling work items into the vault validates the entire knowledge graph concept with real data.

3. **Signals Framework** — Azure DevOps is the first adapter, but the Signals framework it requires (adapter registration, sync lifecycle, connection management) becomes reusable infrastructure for future integrations (RSS feeds, GitHub, Jira, etc.).

4. **Knowledge Graph Growth** — L-25 from the refinement: "Dogfooding reveals integration gaps faster than any spec. Work done outside the system is invisible to the knowledge graph." Azure DevOps data is currently invisible.

5. **First Network Call** — This is architecturally significant: the plugin has been local-only until now. Introducing network calls establishes patterns for authentication, error handling, retry logic, and offline resilience that every future integration will inherit.

### Dependencies and Prerequisites

| Prerequisite | Source | Status | Required Before Azure DevOps? |
|-------------|--------|--------|-------------------------------|
| SessionService extraction (TD-101) | Cycle 9 | Planned | **No** — independent domain |
| Session performance (TD-100) | Cycle 9 | Planned | **No** — independent domain |
| Error handling foundation (TD-114, TD-116, etc.) | Cycle 10 Inc 1 | Planned | **Yes** — network calls need robust error handling |
| Resource leak remediation (TD-110, TD-104, etc.) | Cycle 10 Inc 2 | Planned | **Recommended** — long-running sync needs clean disposal |
| EventBus resilience (TD-105, TD-117) | Cycle 10 Inc 3 | Planned | **Yes** — signal events must not silently fail |
| Infrastructure correctness (TD-62, TD-64, etc.) | Cycle 10 Inc 4 | Planned | **No** — unrelated to network integration |
| UI performance (TD-112, TD-75, etc.) | Cycle 10 Inc 5 | Planned | **No** — unrelated |
| Component extraction (TD-113, etc.) | Cycle 10 Inc 6 | Planned | **No** — stretch item |

**Conclusion:** Cycle 9 is independent of Azure DevOps but should still proceed (it unblocks PBI-SW-017 and reduces architectural debt). Cycle 10 Increments 1–3 are essential prerequisites for reliable network integration. Increments 4–6 can be deferred.

---

## 3. Revised Cycle Sequence

### Recommended Sequence

| Cycle | Theme | Change | Rationale |
|-------|-------|--------|-----------|
| **9** | SessionService Extraction & Intelligence | **Unchanged** | Independent domain work. Prerequisite for PBI-SW-017. |
| **10** | Essential Infrastructure Hardening | **Slimmed: 3 increments** (was 6) | Only error handling, resource leaks, EventBus resilience. Essential foundation for network calls. |
| **11** | **Azure DevOps Integration** | **NEW** | User's explicit priority. First external integration. Addresses RB-5. |
| **12** | Release Preparation | **Moved from 11 → 12** | Installer, canvas importer, quick capture, BRAT. Absorbs deferred Cycle 10 items. |
| **13** | Canvas Sessions & Dogfooding | **Moved from 12 → 13** | Canvas workspace, templates, auto-documentation. |

### Impact Assessment

| Dimension | Impact |
|-----------|--------|
| **RB-5 resolution** | Moved from "Deferred" to **Cycle 11** — addressed 2 cycles earlier |
| **Cycle 10 scope reduction** | 28 items → 17 items (Inc 1–3 only). 11 items deferred to Cycle 12. |
| **Release Preparation delay** | Pushed by 1 cycle. Acceptable: release blockers RB-1/RB-3/RB-4 remain on the roadmap. |
| **Canvas delay** | Pushed by 1 cycle. Acceptable: canvas is enhancement, not release blocker. |
| **New architecture introduced** | Signals framework, HTTP adapter, PAT auth — significant but contained in new domain. |
| **Tech debt remaining** | ~48 open items after Cycle 10 (was target 37). Deferred items absorbed into Cycle 12. |

### Cycle 10 — Revised Scope (3 Increments)

| Inc | Theme | Items | Unchanged? |
|-----|-------|-------|------------|
| 1 | Error Handling Foundation | TD-114, TD-116, TD-115, TD-102, TD-107, TD-106, TD-56 | Yes |
| 2 | Resource Leak Remediation | TD-110, TD-111, TD-104, TD-103, TD-65, TD-74, TD-61 | Yes |
| 3 | EventBus Resilience | TD-105, TD-117, TD-72 | Yes |

**Deferred to Cycle 12:**
- Inc 4: Infrastructure Correctness (TD-62, TD-64, TD-67, TD-71, TD-108, TD-109)
- Inc 5: UI Performance (TD-112, TD-75, TD-76, TD-46)
- Inc 6: Component Extraction (TD-113, TD-70, TD-68)

---

## 4. Azure DevOps Integration — Scope Overview

### Architecture: Signals Framework

Azure DevOps Integration introduces a new **Signal domain** — the first adapter in a reusable integration framework.

```
src/domain/signal/
├── types.ts           # SignalConfig, SignalState, WorkItemMapping, SyncResult
├── events.ts          # SignalEventMap (signal.* events)
├── SignalService.ts   # Signal lifecycle, sync orchestration, state management
├── adapters/
│   └── AzureDevOpsAdapter.ts  # REST API client for Azure DevOps
└── mappers/
    └── workItemMapper.ts      # Work Item → vault note mapping
```

### Key Capabilities

1. **Signal Configuration** — Add Azure DevOps connections (org, project, PAT)
2. **Connection Testing** — Validate PAT and project access before first sync
3. **Work Item Pull** — Fetch work items via Azure DevOps REST API
4. **Note Mapping** — Transform work items into vault notes with structured frontmatter
5. **Manual Sync** — User-triggered pull operation
6. **Multi-Project** — Support multiple Azure DevOps projects as separate signals
7. **Sync Status** — Track last sync time, item counts, errors

### What It Does NOT Include (Deferred)

- Push (write-back to Azure DevOps)
- Bi-directional sync
- Real-time / periodic auto-sync
- Git repository import
- Azure DevOps Pipelines integration
- Other signal adapters (RSS, GitHub, Jira)

### Estimated Scope

| Dimension | Estimate |
|-----------|----------|
| Production LOC | ~600–800 |
| Test count | ~80–120 |
| New events | ~10–12 |
| New types | ~8–10 |
| Increments | 5 |
| Dependencies | Cycle 10 Inc 1–3 (error handling, EventBus resilience) |

---

## 5. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Azure DevOps REST API complexity underestimated | Medium | Medium | Time-box API exploration as Inc 1 spike. Use well-documented Work Item Tracking API. |
| PAT storage security concerns | Low | High | Use Obsidian's `loadData/saveData` (local, encrypted at OS level). Never log or emit PAT values. |
| Network error handling patterns not established | Low | High | Cycle 10 Inc 1+3 specifically address error handling and EventBus resilience. |
| Signal framework over-engineered for first adapter | Medium | Medium | Start with concrete Azure DevOps adapter. Extract framework interfaces only when second adapter arrives. |
| Rate limiting / API throttling | Low | Medium | Implement exponential backoff in adapter. Azure DevOps allows 800 requests/5 minutes for PAT auth. |
| Deferred tech debt items compound | Medium | Low | Fold deferred Cycle 10 items into Cycle 12 as explicit increments. |

---

## 6. Decision

**Adopt the revised sequence:** Cycle 9 (unchanged) → Cycle 10 (slimmed) → Cycle 11 (Azure DevOps) → Cycle 12 (Release Prep + deferred debt) → Cycle 13 (Canvas & Dogfooding).

### Next Steps

1. **Create Azure DevOps Integration PRD** — Feature PRD with FRs, data model, events, FRI scoring
2. **Create Cycle 11 planning document** — Formal cycle plan with increments, risks, success criteria
3. **Update Cycle 10 plan** — Remove Inc 4–6, note deferral rationale
4. **Run Definition of Ready** — Verify Cycle 11 meets all DoR criteria

---

## Related

- [[backlog-refinement-2026-02-20]] — trigger for this review
- [[Cycle 9 - Service Extraction and Intelligence]] — unchanged
- [[Cycle 10 - Refactoring and Technical Debt Cleanup]] — slimmed to 3 increments
- [[I want to get my Azure DevOps Boards Backlog into my Vault]] — canonical inbox item
- [[Data Exchange Hub PRD]] — parent hub for Signals

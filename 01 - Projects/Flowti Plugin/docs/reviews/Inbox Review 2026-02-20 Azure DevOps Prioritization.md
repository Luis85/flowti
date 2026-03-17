---
type: InboxReview
date: 2026-02-20
scope: "Idea-to-solution workflow for Azure DevOps Integration — update inbox items, add traceability, verify backlog refinement items"
trigger: "[[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]"
items_reviewed: 11
items_updated: 11
---

# Inbox Review — Azure DevOps Prioritization

## Context

Following the cycle sequence review that elevated Azure DevOps Integration to Cycle 11, this review applies the **Idea Lifecycle** workflow to all affected inbox items. Per the [[Idea Lifecycle]], items progress through: Capture → Ingestion & Massaging → Typing → Qualification → Backlog Item Creation → PRD Lifecycle.

The Azure DevOps items have now completed all 6 steps:
- **Step 1** (Capture): 5 original inbox items exist across both inboxes
- **Step 2** (Ingestion): Items enriched with context, descriptions, domain tags, related links
- **Step 3** (Typing): All typed as `idea` / domain `signal`
- **Step 4** (Qualification): Qualified via cycle sequence review and PRD creation
- **Step 5** (Backlog Item): 5 PBI documents created (SIG-001 through SIG-005)
- **Step 6** (PRD Lifecycle): [[Azure DevOps Integration PRD]] at FRI 24/35 (draft, pending Technical Review)

---

## Items Updated — Azure DevOps / Signals (6 items)

| # | Item | Inbox | Changes |
|---|------|-------|---------|
| 1 | [[I want to get my Azure DevOps Boards Backlog into my Vault]] | Plugin | **Normalized**: Added full frontmatter (was missing entirely). Stage: planned, priority: 2-high, parent: Azure DevOps Integration PRD, domain: signal, planned_in: Cycle 11, pbi: SIG-001, 4 related links |
| 2 | [[I want to import an Azure DevOps Boards project with all of it's workitems]] | Plugin | Stage: discovery → **planned**, priority: 0-low → **2-high**, parent: DX Hub PRD → **Azure DevOps Integration PRD**, domain: data-exchange → **signal**, added: planned_in, pbi (SIG-003), related |
| 3 | [[I want to connect to Azure DevOps Boards and get all items and git repos]] | Vault | Stage: discovery → **planned**, priority: 0-low → **2-high**, parent: DX Hub PRD → **Azure DevOps Integration PRD**, domain: data-exchange → **signal**, added: planned_in, pbi (SIG-002), note (git repo deferred) |
| 4 | [[I want to manage multiple Azure DevOps Boards in Flowti]] | Vault | Stage: discovery → **planned**, priority: 0-low → **2-high**, parent: DX Hub PRD → **Azure DevOps Integration PRD**, domain: data-exchange → **signal**, added: planned_in, pbi (SIG-005), note (FR-07) |
| 5 | [[I want to extend the data exchange hub with Signals, those are the domain for integrations]] | Vault | Stage: discovery → **planned**, priority: 0-low → **2-high**, parent: DX Hub PRD → **Azure DevOps Integration PRD**, domain: data-exchange → **signal**, added: planned_in, pbi (SIG-001), note (v1 pull-only) |
| 6 | [[I want to connect a pipeline to a Outbound Signal so that I can push files to other systems]] | Vault | **Unchanged stage** (discovery, 0-low). Updated: domain → signal, parent → Azure DevOps Integration PRD, added: tags, related links, note (deferred to v2) |

---

## Items Updated — Cycle Sequence Shift (5 items)

These items were planned for "Cycle 11: Release Preparation" in the backlog refinement but moved to **Cycle 12** after the cycle sequence review inserted Azure DevOps as Cycle 11.

| # | Item | Inbox | Changes |
|---|------|-------|---------|
| 7 | [[I want the installer to use a versioned JSON folder config instead of hardcoded paths]] | Plugin | Added: planned_in: Cycle 12, related: cycle sequence review, note: updated to reference Cycle 12 |
| 8 | [[Canvas importer must be a first-class plugin feature]] | Plugin | Added: planned_in: Cycle 12, related: cycle sequence review, note: updated to reference Cycle 12 |
| 9 | [[Installer should seed starter content on first run]] | Plugin | Added: planned_in: Cycle 12, related: cycle sequence review, note: updated to reference Cycle 12 |
| 10 | [[Quick capture ribbons for ideas and feedback]] | Plugin | Added: planned_in: Cycle 12, related: cycle sequence review |
| 11 | [[Pipeline multi-source merge with master data builder]] | Plugin | Added: planned_in: Cycle 12, related: cycle sequence review |

---

## Inbox Health — Post-Review

### Plugin Inbox (c:\Projects\flowti\Development\flowti\docs\inbox\)

| Metric | Before | After |
|--------|--------|-------|
| Items with `planned` stage | 6 | 8 (+2 Azure DevOps items) |
| Items with `planned_in` field | 0 | 7 (5 release prep + 2 Azure DevOps) |
| Items missing frontmatter | 1 | 0 (canonical Azure DevOps item normalized) |
| Items with `pbi` link | 0 | 2 (Azure DevOps items linked to PBIs) |
| Domain `signal` items | 0 | 2 (new domain) |

### Vault Inbox (c:\Projects\flowti\00 - Connectivity\inbox\)

| Metric | Before | After |
|--------|--------|-------|
| Items with `planned` stage | 0 | 3 (+3 Azure DevOps/Signals items) |
| Items with `planned_in` field | 0 | 3 |
| Items with `pbi` link | 0 | 3 |
| Domain `signal` items | 0 | 4 (3 planned + 1 discovery) |

### Traceability Chain (Azure DevOps)

```
Inbox items (5 planned)
  → Azure DevOps Integration PRD (FRI 24/35)
    → PBI-SIG-001 through PBI-SIG-005 (5 PBIs)
      → Cycle 11 - Azure DevOps Integration (5 increments)
        → Definition of Ready Check (Conditional Pass)
```

Every item now has bidirectional links: inbox → PRD → PBI → cycle plan.

---

## Remaining Inbox Items — No Action Needed

The following planned items from the backlog refinement were verified as correctly staged and do not need updates:

- **I want to provide a folder-structure as json to the installer**: `planned`, `critical`, RB-1 — correctly references elaborated item
- **Starting a Canvas Session**: `planned`, `high` — correctly references canvas workspace item
- **I want to capture feedback and input as fast as possible**: `planned`, `high` — correctly references quick capture item

---

## Related

- [[Idea Lifecycle]] — process followed for this review
- [[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]] — trigger
- [[Azure DevOps Integration PRD]] — target PRD
- [[backlog-refinement-2026-02-20]] — prior refinement

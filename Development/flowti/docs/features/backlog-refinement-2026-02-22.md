---
type: BacklogRefinement
date: 2026-02-22
stage: done
description: "Comprehensive inbox triage, PRD backlog updates, persona/JTBD enrichment, and Cycle 16 feature discovery"
---

# Backlog Refinement — 2026-02-22

## Session Summary

This refinement session processed all inbox items across both inboxes, updated 6 feature PRD backlogs, enriched all personas and JTBDs, resolved 4 tech debt items, and identified 6 new feature candidates for future cycles.

## Inbox Triage

### Plugin Inbox (105 files)
- **Type normalization**: 21 files corrected from lowercase to Title Case (idea->Idea, bug->Bug, etc.)
- **Stage updates**: promoted items with parent PRDs
- **Cross-linking**: 16 files linked to parent PRDs with `parent:` and `pbi:` frontmatter

### Vault Inbox (160 files)
- **Type normalization**: 46 files normalized
- **Type reclassification**: 5 files reclassified (e.g., Question -> Idea)
- **Malformed fixes**: 2 files with broken frontmatter repaired
- **Origin standardized**: 160 files tagged with `origin: inbox`
- **Cross-linking**: Canvas and prioritization items linked to PRDs

## PRD Backlog Updates

| PRD | New PBIs | Notes |
|-----|----------|-------|
| Session Workspaces | PBI-SW-020 (Session Chaining), PBI-SW-021 (Template Management UI), PBI-SW-022 (Clickable URLs) | 8 PBIs now planned |
| Data Exchange Hub | PBI-008 (Execution Timing), PBI-009 (Report Ingestion), PBI-010 (Data Dictionary Integration) | Bugs tracked in TD-124, TD-125 |
| Canvas Integration | Stage -> delivered, v2 inbox cross-refs added | PBI-CAN-001 done (Cycle 15) |
| Azure DevOps Integration | PBI-SIG-006 (Outbound Signals), PBI-SIG-007 (Auto-Sync), PBI-SIG-008 (Additional Adapters), PBI-SIG-009 (Work Item Relationships) | Section 16 added |
| Installer | PBI-005 (JSON Folder Config, RB-1), PBI-006 (CLI Installer) | 2 new PBIs |
| Hubs | PBI-006 (Inbox Item Routing), PBI-007 (Bulk Frontmatter Updates) | 2 new PBIs |

**Total new PBIs added**: 16

## Persona Updates

All 9 persona files updated to reflect delivered capabilities:

| Persona | Status | Key Update |
|---------|--------|------------|
| Strategic Systems Builder | Primary, comprehensive | 15 domains, 10 features, 9 JTBDs |
| Product Owner | Enriched | Session planning, Event Catalog traceability |
| Developer | Enriched | Session-driven development, activity intelligence |
| System Designer | Expanded from stub | 7 goals, 6 pain points, Event Catalog focus |
| Knowledge Worker | Written from scratch | Data processing workflows, inbox |
| Citizen Developer | Expanded | Guided wizards, DX Hub pipeline builder |
| Software Architect | Enriched | Domain event contracts, Canvas modeling |
| Delivery Manager | Enriched | Signal sync delivered, risk dashboards pending |
| Integration Node | Expanded (Actor) | Delivered vs planned system tables |

**Tech debt resolved**: TD-79 (persona stubs)

## JTBD Updates

All 21 JTBD files populated with full content (5 sections each):
- **4 validated**: Azure DevOps sync, flow design, content distribution, traceability
- **16 draft**: product backlog, project management, RAID log, documentation, data quality, etc.
- **1 meta-JTBD**: "All-in-one Product Management Solution" (references 15 sub-jobs)

**Tech debt resolved**: TD-80 (95% JTBD stubs)

## Tech Debt Changes

| Item | Action | Status |
|------|--------|--------|
| TD-79 | Persona stubs resolved | open -> resolved |
| TD-80 | JTBD stubs resolved | open -> resolved |
| TD-85 | Inbox files remediated (265 files) | open -> partially-resolved |
| TD-24 | Stats audit note added (3,548 tests) | open (note added) |
| TD-92 | Critical flag added (approaching release) | open (note added) |
| TD-123 | NEW: Closure review dashboard bug | open |
| TD-124 | NEW: Exporter formula evaluation bug | open |
| TD-125 | NEW: Pipeline progress bar state issues (3 bugs consolidated) | open |

**Net change**: 2 resolved, 3 new = 1 more open item (but 2 high-severity items closed)

## Release Blocker Status

| RB | Title | Status | Changed? |
|----|-------|--------|----------|
| RB-1 | Repository Restructure | OPEN | -- |
| RB-2 | ESLint Compliance | OPEN | -- |
| RB-3 | Canvas Import | RESOLVED | Cycle 15 |
| RB-4 | Seed Starter Content | OPEN | -- |
| RB-5 | External Data Ingestion | RESOLVED | Cycle 11 |
| RB-6 | Documentation Stubs | RESOLVED | This session (TD-79, TD-80) |
| RB-7 | Pipeline Multi-Source Merge | OPEN | -- |
| RB-8 | CLI Installer | OPEN | Discovery |

## New Feature Candidates (Not Covered by Existing PRDs)

### 1. Prioritization Hub (NEW DOMAIN) -> SELECTED FOR CYCLE 16
- **Source**: "We need a tool to prioritize notes" (plugin inbox) + JTBD gap
- **Scope**: Scoring sessions, ranking, ELO pairwise comparison, weighted dimensions
- **Persona**: Product Owner, Strategic Systems Builder
- **Strategic value**: HIGH -- addresses #1 Product Owner pain point
- **Decision**: Selected as Cycle 16 theme

### 2. Cycle & Increment Manager (NEW DOMAIN)
- **Source**: ~10 vault inbox items about process visibility
- **Scope**: Visual cycle planning, increment progress, cycle health dashboard
- **Persona**: Delivery Manager, Strategic Systems Builder
- **Strategic value**: HIGH -- dogfooding story
- **Decision**: Deferred to Cycle 17+

### 3. Quick Capture Enhancement (EXTEND EXISTING)
- **Source**: 13 vault inbox items
- **Scope**: Ribbon shortcuts, auto-type from title, template-matched quick add
- **Persona**: Knowledge Worker, Citizen Developer
- **Decision**: Deferred to Cycle 17+

### 4. Companion Sidebar (NEW FEATURE)
- **Source**: 3 inbox items about context-aware sidebar
- **Scope**: Shows related events, domains, flows for currently open file
- **Persona**: System Designer, Knowledge Worker
- **Decision**: Deferred to Cycle 18+

### 5. Command Palette as API (ENHANCEMENT)
- **Source**: 2 high-priority vault items
- **Scope**: All flows as commands, auto-documented command catalog
- **Persona**: Strategic Systems Builder, Citizen Developer
- **Decision**: Deferred to Cycle 17+

### 6. E2E Testing Framework (INFRASTRUCTURE)
- **Source**: 2 high-priority plugin inbox items
- **Scope**: Automated end-to-end tests, release verification
- **Decision**: Deferred to Release Preparation Cycle

## Unassigned Discovery Items

**126 items** remain in discovery stage without parent PRDs:
- Plugin inbox: 24 items (session: 5, documentation: 4, data-exchange: 4, meta: 4, testing: 2, other: 5)
- Vault inbox: 102 items (session: 31, process: 19, AI: 17, infrastructure: 13, capture: 13, documentation: 12, automation: 11, data-exchange: 9, signal: 7, other: 11)

**Largest unaddressed area**: AI integration (17 vault items) -- deferred as exploratory/future

## Next Steps

1. Create Prioritization Hub PRD -> Cycle 16 planning
2. Schedule Three Amigos review for Cycle 15
3. Consider Cycle & Increment Manager for Cycle 17
4. Release Preparation Cycle when feature set stabilizes

---

## Related

- [[backlog-refinement-2026-02-20]] -- previous refinement
- [[backlog-refinement-2026-02-18]] -- earlier refinement

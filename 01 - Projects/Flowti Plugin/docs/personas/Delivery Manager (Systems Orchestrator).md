---
type: Persona
stage: done
description: "Orchestrates delivery flow, risk visibility, and cross-system operational data"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
roles:
  - user
related_domains:
  - signal
  - session
  - data-exchange
  - hub
  - event-catalog
  - inbox
related_features:
  - Signal Integration
  - Session Workspaces
  - Data Exchange Hub
  - Event Catalog
  - Inbox
---
# Delivery Manager (Systems Orchestrator)

## Identity

### Name & Role

Delivery Manager — Systems Orchestrator who sees the whole machine and focuses on flow, risk, and execution.

### Archetype

Sees the whole machine. Focused on flow, risk, and execution. Connects operational data with project progress to make delivery transparent and bottlenecks visible early. Orchestrates across systems rather than operating within a single domain.

### Quote

> "I need to see what's stuck, what's at risk, and what's flowing — across every system, in one place."

### Profile Summary

The Delivery Manager operates at the intersection of multiple systems — Azure DevOps for work items, the vault for documentation, and external tools for operational data. They use Signal Integration to pull Azure DevOps work items into the vault automatically, Session Workspaces to track execution with lifecycle states and reflection, the Event Catalog to trace progress through domain events, and the Data Exchange Hub to build pipeline reports aggregating data from multiple sources. The Inbox keeps them aware of system changes without constant manual checking.

## Core Goals

- Make delivery transparent across all systems
- Identify bottlenecks early before they become blockers
- Connect operational data with project progress
- Provide management insights through structured reporting
- Ensure governance compliance

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Sync Azure DevOps work items into vault | Critical | [[Signal Integration]] (inbound pull, PAT auth, WIQL) |
| Track execution lifecycle states | Critical | [[Session Workspaces]] (6-state lifecycle) |
| Connect operational data across systems | High | [[Data Exchange Hub]] (multi-source pipelines) |
| Trace progress through domain events | High | [[Event Catalog]] (cross-references, flow tracking) |
| Generate delivery reports | High | [[Data Exchange Hub]] (CSV/JSON/Markdown export) |
| Monitor risk exposure | High | [[Event Catalog]] (undocumented badges), [[Inbox]] |
| Ensure governance compliance | Medium | [[Documentation Hub]] (structured entities) |

### Success Criteria

- Azure DevOps work items synced automatically via Signal with conflict resolution
- Delivery progress visible through session statistics and event cross-references
- Pipeline reports aggregating data from multiple sources via DX Hub
- Inbox notifications providing early warning of system changes
- Execution sessions tracked with intent, energy, and reflection for team retrospectives

## Jobs To Be Done

- Sync Azure DevOps work items via Signal Integration (PAT auth, WIQL queries, per-item error resilience, conflict strategies: skip/update/overwrite)
- Track delivery lifecycle states using Session Workspaces (prepared→running→paused→reviewing→completed→archived)
- Monitor delivery progress via Event Catalog cross-references (events → flows → systems)
- Build pipeline reports using Data Exchange Hub multi-source pipelines with aggregated results
- Export delivery data as CSV/JSON/Markdown for stakeholder reporting
- Monitor system health through Inbox notifications (6 source events, unread count in User Hub)
- Trigger Signal sync via command palette for on-demand work item updates

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Hidden dependencies between systems | Critical | Manual tracking, hope | [[Event Catalog]] (cross-references, flow tracing) ✓ |
| Late surprises in delivery | Critical | Status meetings, heroics | [[Inbox]] (6 source events, unread count) ✓, [[Signal Integration]] ✓ |
| Manual reporting across systems | High | Spreadsheet aggregation | [[Data Exchange Hub]] (multi-source pipelines, CSV/JSON export) ✓ |
| Lack of cross-system visibility | High | Multiple dashboards open | [[Signal Integration]] (Azure DevOps sync) ✓, [[Data Exchange Hub]] ✓ |
| Work items out of sync between DevOps and vault | High | Manual copy-paste | [[Signal Integration]] (inbound pull, conflict strategies) ✓ |
| No lifecycle tracking for execution | Medium | Ad-hoc status updates | [[Session Workspaces]] (6-state lifecycle, session statistics) ✓ |
| Risk dashboards not yet available | Medium | Manual risk registers | Planned — not yet delivered |
| State machine visualization not yet available | Low | Manual flow diagrams | Planned — not yet delivered |

## What Flowti Delivers

- **Signal Integration** — Azure DevOps work item sync with PAT authentication, WIQL queries, per-item error resilience, and conflict strategies (skip/update/overwrite). Command palette sync for on-demand updates. Inbound pull architecture ✓
- **Session Workspaces** — Execution tracking with 6-state lifecycle (prepared→running→paused→reviewing→completed→archived), intent setting, energy tracking, execution tasks, and reflection journaling. Session statistics visible in User Hub ✓
- **Event Catalog** — Progress tracing through 100+ domain events with cross-references to flows, systems, and actors. 15 bounded contexts provide structural organization ✓
- **Data Exchange Hub** — Multi-source pipelines with aggregated results for delivery reporting. CSV/JSON/Markdown export with formula support. 7 tabs for different data operations ✓
- **Inbox/Notifications** — 6 source events with mark read/dismiss/clear, 500-item cap, and unread count in User Hub for early warning awareness ✓

### Not Yet Delivered

- Risk dashboards with visual risk exposure mapping
- State machine visualization for delivery lifecycle
- ERP (Epicor Prophet 21) signal connector

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| signal | Heavy | Azure DevOps sync, work item ingestion |
| session | Heavy | Execution tracking, lifecycle states |
| data-exchange | Heavy | Pipeline reports, data aggregation, export |
| event-catalog | Heavy | Progress tracing, cross-references |
| hub | Moderate | Navigation, tab workflows |
| inbox | Moderate | Early warning, change notifications |
| user-hub | Light | Session statistics, inbox panel |
| documentation | Light | Governance docs, structured entities |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Synchronize External Systems]]
- [[JTBD - Track Delivery Lifecycle]]
- [[JTBD - Generate Delivery Reports]]
- [[JTBD - Monitor Risk Exposure]]

### Features Used

- [[Signal Integration]]
- [[Session Workspaces]]
- [[Data Exchange Hub]]
- [[Event Catalog]]
- [[Inbox]]
- [[User Hub]]

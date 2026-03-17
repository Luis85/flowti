---
type: Persona
stage: done
description: "The architect of integrated systems who bridges strategy and execution through event-driven domain modeling"
roles:
  - user
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
related_domains:
  - session
  - signal
  - data-exchange
  - hub
  - installer
  - event-catalog
  - documentation
  - inbox
  - canvas
  - subscription
  - ingestion
  - user-hub
  - notification
  - activity
  - lifecycle
related_features:
  - Event Catalog
  - Session Workspaces
  - Data Exchange Hub
  - Signal Integration
  - Hubs
  - Canvas Integration
  - Documentation Hub
  - Installer
  - Inbox
  - User Hub
---
# Strategic Systems Builder

## Identity

### Name & Role

Strategic Systems Builder — the primary persona for Flowti IBDE.

### Archetype

The architect of integrated systems. Thinks in models, domains, events, lifecycle states, quality loops. Bridges product ownership, delivery management, and system architecture into a single operating model.

### Quote

> "I don't just build features — I build the system that makes features composable, traceable, and sustainable."

### Profile Summary

A Product Owner + Delivery Manager hybrid with deep skills in Requirements Engineering, Architecture, and Process Design. This persona designs coherent operating models across tools, ensures traceability from idea to impact, and reduces cognitive overload through structured execution environments. They are the power user who exercises every major surface of Flowti IBDE — from event modeling to session-driven execution to cross-system signal integration.

## Core Identity

- Product Owner + Delivery Manager hybrid
- Bridges Strategy & Execution
- Builds systems that make complexity manageable
- Strong in Requirements Engineering, Architecture, and Process Design
- Operates across all 15 bounded contexts

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Design a coherent operating model across tools | Critical | [[Hubs]], [[Event Catalog]] |
| Make work traceable from idea → execution → impact | Critical | [[Event Catalog]], [[Session Workspaces]] |
| Ensure auditability and quality compliance (ISO, IREB) | High | [[Documentation Hub]], [[Event Catalog]] |
| Reduce cognitive overload through structured environments | High | [[Session Workspaces]], [[User Hub]] |
| Create reusable architectural patterns | High | [[Event Catalog]], [[Documentation Hub]] |
| Integrate external systems into a unified event model | High | [[Signal Integration]], [[Data Exchange Hub]] |
| Automate data flows without leaving Obsidian | Medium | [[Data Exchange Hub]], [[Canvas Integration]] |

### Success Criteria

- All domain events documented and cross-referenced across 15 bounded contexts
- Session-driven execution with intent tracking and reflection journaling
- External system data flowing into vault via Signal and DX Hub pipelines
- Living documentation that stays current with architectural decisions
- New team members onboarded through Installer wizard and PARA scaffolding

## Jobs To Be Done

- Design a coherent operating model across tools
- Make work traceable from idea → execution → impact
- Ensure auditability and quality compliance (ISO, IREB)
- Reduce cognitive overload through structured environments
- Create reusable architectural patterns
- Model domain boundaries using the Event Catalog
- Execute focused work sessions with intent, energy tracking, and reflection
- Synchronize external work items via Signal Integration
- Import and transform data through the Data Exchange Hub

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Tool fragmentation (DevOps, ERP, M365, Obsidian) | Critical | Manual copy-paste between systems | [[Signal Integration]] ✓, [[Data Exchange Hub]] ✓ |
| Backlogs that are too vague | High | Repeated stakeholder meetings | [[Session Workspaces]] (intent setting) ✓, [[Documentation Hub]] ✓ |
| Loss of context across systems | High | Personal notes, memory | [[Event Catalog]] (cross-references) ✓, [[Inbox]] ✓ |
| Manual synchronization | High | Scheduled manual exports | [[Signal Integration]] (Azure DevOps sync) ✓, [[Data Exchange Hub]] (pipelines) ✓ |
| Knowledge decay | Medium | Periodic documentation sprints | [[Documentation Hub]] (living docs) ✓, [[Event Catalog]] (undocumented badges) ✓ |
| Context switching between work modes | Medium | Willpower, sticky notes | [[Session Workspaces]] (6-state lifecycle, cognitive overload detection) ✓ |

## What Flowti Delivers

- **Event Catalog as Source of Truth** — 100+ domain events, 15 event categories, 15 bounded contexts, subscriptions, definitions, cross-references to flows/systems/actors ✓
- **Signal Integration** — Azure DevOps work item sync with PAT auth, WIQL queries, per-item error resilience, conflict strategies (skip/update/overwrite) ✓
- **Session Workspaces** — 6-state lifecycle (prepared→running→paused→reviewing→completed→archived), intent setting, energy tracking, execution tasks, reflection journaling, closure ritual, activity intelligence, cognitive overload detection, 8 session types, sidebar companion ✓
- **Data Exchange Hub** — CSV import with merge keys, CSV/JSON/Markdown export with formulas, multi-source pipelines, canvas import (Obsidian .canvas → vault notes), Base file integration, 7 tabs ✓
- **Hubs Framework** — BaseHubView shell with tab bars, split layouts, debounced rendering, hub lifecycle events ✓
- **Documentation Hub** — File-driven entities (Domains, Services, Events, Flows, Systems, Actors, Products), auto-normalize frontmatter, undocumented badges, CRUD via Event Catalog tabs ✓
- **Installer** — 4-page first-run wizard, PARA folder scaffolding, user profile creation, extensible step pipeline, idempotent ✓
- **Canvas Integration** — Canvas parser, node→note mapping, hierarchy detection (flat/nested/grouped), target folder, DX Hub integration, saved configs ✓
- **User Hub** — User profile, session statistics, inbox panel, settings shortcuts ✓
- **Inbox/Notifications** — 6 source events, mark read/dismiss/clear, 500-item cap, unread count in User Hub ✓

## Power Features

- Typed EventBus with 100+ domain events across 15 bounded contexts ✓
- Signal synchronization engine with Azure DevOps inbound pull and conflict strategies ✓
- Living documentation via Documentation Hub with auto-normalized frontmatter and undocumented badges ✓
- Exportable architecture artifacts via CSV/JSON/Markdown export with formula support ✓
- Session Workspaces with activity intelligence and cognitive overload detection ✓
- Canvas-to-vault import with hierarchy detection and saved configurations ✓
- Multi-source data pipelines with aggregated results ✓
- Command palette integration for Signal sync ✓

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| session | Heavy | Daily execution, intent tracking, reflection |
| event-catalog | Heavy | Domain modeling, event registration, cross-references |
| documentation | Heavy | Living docs, entity management, architecture decisions |
| signal | Heavy | Azure DevOps sync, external data ingestion |
| data-exchange | Heavy | Import/export pipelines, data transformation |
| hub | Heavy | Navigation shell, tab-based workflows |
| installer | Moderate | First-run setup, PARA scaffolding |
| canvas | Moderate | Visual modeling, canvas-to-vault import |
| inbox | Moderate | Notifications, event awareness |
| user-hub | Moderate | Profile, statistics, settings |
| subscription | Moderate | Event subscriptions, notification routing |
| ingestion | Moderate | Data pipeline orchestration |
| notification | Light | System alerts, session reminders |
| activity | Light | Activity intelligence, overload detection |
| lifecycle | Light | State transitions, session states |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Model Domain Boundaries]]
- [[JTBD - Execute Focused Work Sessions]]
- [[JTBD - Synchronize External Systems]]
- [[JTBD - Import and Transform Data]]
- [[JTBD - Document Architecture Decisions]]
- [[JTBD - Track Work From Idea to Impact]]

### Features Used

- [[Event Catalog]]
- [[Session Workspaces]]
- [[Data Exchange Hub]]
- [[Signal Integration]]
- [[Documentation Hub]]
- [[Hubs]]
- [[Canvas Integration]]
- [[Installer]]
- [[Inbox]]
- [[User Hub]]

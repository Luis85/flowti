---
type: Persona
stage: done
description: "Implements and tests the system with clear requirements and fast feedback"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
roles:
  - user
related_domains:
  - session
  - event-catalog
  - documentation
  - data-exchange
  - activity
related_features:
  - Session Workspaces
  - Event Catalog
  - Documentation Hub
  - Data Exchange Hub
---
# Developer (Execution Specialist)

## Identity

### Name & Role

Developer — Execution Specialist who implements and validates the system through focused, session-driven development.

### Archetype

Implements and tests the system with clear requirements and fast feedback loops. Operates within structured execution environments to reduce context switching and maintain flow state.

### Quote

> "Give me a clear session intent, the domain contracts, and get out of my way."

### Profile Summary

A developer who thrives on clarity and focus. Uses Session Workspaces to create intentional execution environments for each development task — setting intent, tracking energy, executing tasks, and reflecting on outcomes. Consults the Event Catalog to understand domain contracts and event flows before implementation. Relies on the Documentation Hub for specifications and the Data Exchange Hub for test data management. Activity Intelligence provides self-awareness about work patterns and cognitive load.

## Core Goals

- Clear requirements with minimal ambiguity
- Fast feedback loops during implementation
- Structured code base aligned with domain boundaries
- Reduced context switching through focused sessions

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Understand PBIs precisely before implementation | Critical | [[Event Catalog]], [[Documentation Hub]] |
| Execute focused development sessions | Critical | [[Session Workspaces]] (intent, energy, tasks) |
| Write and manage tests effectively | High | [[Session Workspaces]] (execution tasks) |
| Minimize context switching | High | [[Session Workspaces]] (sidebar companion, cognitive overload detection) |
| Access domain contracts and event definitions | High | [[Event Catalog]] (subscriptions, definitions) |
| Export/import test data and artifacts | Medium | [[Data Exchange Hub]] (CSV/JSON export) |

### Success Criteria

- Every development session has a clear intent and measurable execution tasks
- Domain event contracts consulted before writing integration code
- Reflection journaling captures lessons learned per session
- Cognitive overload detected early, prompting session breaks
- Test data managed through structured import/export pipelines

## Jobs To Be Done

- Understand PBIs precisely — consult Event Catalog for domain context, Documentation Hub for entity definitions, cross-references for related flows and systems
- Implement features — use Session Workspaces for session-driven development with intent setting, execution tasks, and energy tracking
- Write and manage tests — track test execution as session tasks, export test results via Data Exchange Hub
- Participate in Planning/Review — use session reflection journaling to prepare review notes, closure ritual to capture outcomes
- Monitor personal productivity — use Activity Intelligence for self-awareness about work patterns and session effectiveness

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Overwritten/vague stories | Critical | Ask PO repeatedly | [[Documentation Hub]] (structured entities, auto-normalize) ✓ |
| Missing acceptance criteria | Critical | Assume and hope | [[Event Catalog]] (event definitions, subscriptions) ✓ |
| Context switching between tasks | High | Willpower, time-boxing | [[Session Workspaces]] (6-state lifecycle, sidebar companion) ✓ |
| No clarity about "why" behind tasks | High | Read old Slack threads | [[Session Workspaces]] (intent setting) ✓, [[Event Catalog]] (cross-references) ✓ |
| Lost development context after interruptions | Medium | Personal notes | [[Session Workspaces]] (pause/resume, reflection journaling) ✓ |
| Cognitive overload during long sessions | Medium | Ignore until burnout | [[Session Workspaces]] (cognitive overload detection, activity intelligence) ✓ |

## What Flowti Delivers

- **Session Workspaces** — Focused execution environment with 6-state lifecycle (prepared→running→paused→reviewing→completed→archived), intent setting, energy tracking, execution tasks, reflection journaling, and cognitive overload detection. Sidebar companion view for non-intrusive session awareness ✓
- **Event Catalog** — Domain event contracts with subscriptions and definitions. Cross-references to flows, systems, and actors provide the "why" behind implementation tasks ✓
- **Documentation Hub** — File-driven entities (Domains, Services, Events, Flows, Systems, Actors, Products) with auto-normalized frontmatter. Undocumented badges flag gaps in specs ✓
- **Data Exchange Hub** — CSV/JSON/Markdown export for test data and artifacts. CSV import with merge keys for structured data ingestion ✓
- **Activity Intelligence** — Self-awareness about work patterns, session effectiveness, and cognitive load trends ✓

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| session | Heavy | Daily development sessions, intent, execution |
| event-catalog | Heavy | Domain contracts, event definitions |
| documentation | Heavy | Specs, entity definitions, architecture docs |
| data-exchange | Moderate | Test data import/export |
| activity | Moderate | Work pattern awareness, overload detection |
| hub | Light | Navigation, tab workflows |
| inbox | Light | Notification awareness |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Understand PBIs Precisely]]
- [[JTBD - Execute Session-Driven Development]]
- [[JTBD - Write and Manage Tests]]
- [[JTBD - Reduce Context Switching]]

### Features Used

- [[Session Workspaces]]
- [[Event Catalog]]
- [[Documentation Hub]]
- [[Data Exchange Hub]]

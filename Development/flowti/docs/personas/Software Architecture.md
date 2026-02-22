---
type: Persona
stage: done
description: "Guardian of structure and technical coherence in domain-driven systems"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
roles:
  - user
related_domains:
  - event-catalog
  - documentation
  - hub
  - canvas
  - session
related_features:
  - Event Catalog
  - Documentation Hub
  - Hubs
  - Canvas Integration
---
# Software Architect

## Identity

### Name & Role

Software Architect — the guardian of structure and technical coherence.

### Archetype

Guardian of structure and technical coherence. Defines boundaries, models domains, designs event contracts, and ensures scalability and consistency across the system. Thinks in bounded contexts, service contracts, and architectural decisions.

### Quote

> "Every undocumented event contract is a future production incident waiting to happen."

### Profile Summary

The Software Architect ensures the system's architecture remains clean, consistent, and well-documented. They use the Event Catalog as their primary tool for modeling domain boundaries across 15 bounded contexts, defining event contracts with subscriptions and definitions, and cross-referencing events to flows, systems, and actors. The Documentation Hub provides structured architecture documentation with auto-normalized frontmatter and undocumented badges that flag documentation gaps. Canvas Integration enables visual architecture modeling, converting diagrams into structured vault documentation. Session Workspaces support focused architecture review sessions.

## Core Goals

- Keep architecture clean and coherent
- Define clear domain boundaries
- Model domains properly using event-driven patterns
- Ensure scalability and consistency in data flow

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Model domain boundaries across bounded contexts | Critical | [[Event Catalog]] (15 bounded contexts, cross-references) |
| Design and enforce event contracts | Critical | [[Event Catalog]] (subscriptions, definitions) |
| Maintain architectural documentation | High | [[Documentation Hub]] (file-driven entities, auto-normalize) |
| Ensure consistency in data flow | High | [[Event Catalog]] (flow cross-references) |
| Identify documentation gaps | High | [[Documentation Hub]] (undocumented badges) |
| Visualize architecture with structured diagrams | Medium | [[Canvas Integration]] (canvas-to-vault) |
| Conduct architecture review sessions | Medium | [[Session Workspaces]] |

### Success Criteria

- All 15 bounded contexts documented with clear domain boundaries
- Event contracts defined with subscriptions, definitions, and cross-references
- Undocumented entities systematically flagged and resolved
- Architecture decisions recorded and traceable (32 ADRs)
- Visual architecture diagrams connected to living documentation
- Domain/service/event/flow/system/actor/product entities consistently structured

## Jobs To Be Done

- Model domain boundaries using the Event Catalog's 15 bounded contexts and domain/service entity tabs
- Design event contracts using Event Catalog's event definitions, subscriptions, and cross-references to flows/systems/actors
- Ensure consistency across domain events by reviewing cross-references and subscription patterns
- Maintain architecture documentation through Documentation Hub's file-driven entities with auto-normalized frontmatter
- Identify and resolve documentation gaps using undocumented badges
- Create visual architecture models using Canvas Integration (Obsidian .canvas → structured vault notes with hierarchy detection)
- Conduct focused architecture review sessions in Session Workspaces with intent and reflection

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Requirements ambiguity erodes architecture | Critical | Repeated clarification meetings | [[Event Catalog]] (event definitions, cross-references) ✓ |
| Scope creep breaks domain boundaries | High | Manual boundary enforcement | [[Event Catalog]] (15 bounded contexts, domain tabs) ✓ |
| Architectural erosion over time | High | Periodic architecture reviews | [[Documentation Hub]] (undocumented badges, auto-normalize) ✓ |
| Architecture docs disconnected from implementation | High | Manual synchronization | [[Documentation Hub]] (file-driven, living documentation) ✓ |
| Visual models don't connect to documentation | Medium | Duplicate content manually | [[Canvas Integration]] (canvas-to-vault, hierarchy detection) ✓ |
| No central event contract registry | Medium | Scattered documentation | [[Event Catalog]] (100+ events, 15 categories) ✓ |

## What Flowti Delivers

- **Event Catalog** — Domain event contracts with subscriptions, definitions, and cross-references across 100+ events, 15 categories, and 15 bounded contexts. CRUD via dedicated tabs for Domains, Services, Events, Flows, Systems, Actors, and Products ✓
- **Documentation Hub** — File-driven entity management with auto-normalized frontmatter. Undocumented badges flag documentation gaps for systematic resolution. Full CRUD operations via Event Catalog tabs ✓
- **Hubs Framework** — BaseHubView shell with tab bars, split layouts, and debounced rendering. Enables side-by-side entity comparison for cross-referencing and architecture reviews ✓
- **Canvas Integration** — Canvas parser converts Obsidian .canvas architecture diagrams into structured vault notes with hierarchy detection (flat/nested/grouped), target folder configuration, and saved configs ✓
- **Session Workspaces** — Focused architecture review sessions with 6-state lifecycle, intent setting, and reflection journaling ✓

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| event-catalog | Heavy | Event contracts, domain modeling, cross-references |
| documentation | Heavy | Architecture docs, entity management, undocumented badges |
| hub | Heavy | Tab navigation, split layouts for architecture review |
| canvas | Moderate | Visual architecture diagrams, canvas-to-vault |
| session | Moderate | Architecture review sessions |
| data-exchange | Light | Export architecture artifacts |
| inbox | Light | Change notifications |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Model Domain Boundaries]]
- [[JTBD - Design Event Contracts]]
- [[JTBD - Ensure Architectural Consistency]]
- [[JTBD - Document Architecture Decisions]]

### Features Used

- [[Event Catalog]]
- [[Documentation Hub]]
- [[Hubs]]
- [[Canvas Integration]]
- [[Session Workspaces]]

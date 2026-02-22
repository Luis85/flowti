---
type: Persona
stage: done
description: "Models systems, services, events, and flows to document software architecture"
plugin: "[[Development/flowti/README|README]]"
domain: Flowti
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
  - Canvas Integration
  - Session Workspaces
---
# System Designer

## Identity

### Name & Role

System Designer — the technical modeler who documents architecture through events, services, flows, and domain boundaries.

### Archetype

A technical user who models systems, services, events, and flows to document the architecture of a software product or business domain. The System Designer uses the Event Catalog to register events, define subscriptions, and map domain boundaries. They create domain documentation, trace event flows, and use health checks to ensure architectural documentation stays consistent and complete.

### Quote

> "Architecture is only real if it's documented, connected, and verifiable."

### Profile Summary

The System Designer lives in the Event Catalog. They register domain events, define subscriptions, model service boundaries, and trace event flows across systems. Using the Documentation Hub's file-driven entities (Domains, Services, Events, Flows, Systems, Actors, Products), they build a living architectural record. Canvas Integration provides visual modeling capabilities, converting Obsidian .canvas diagrams into structured vault notes. Session Workspaces support focused domain decomposition sessions with intent tracking and structured reflection.

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Register and categorize all domain events | Critical | [[Event Catalog]] (100+ events, 15 categories) |
| Define event subscriptions and contracts | Critical | [[Event Catalog]] (subscriptions, definitions) |
| Map domain boundaries across bounded contexts | High | [[Event Catalog]] (15 bounded contexts) |
| Cross-reference events to flows, systems, and actors | High | [[Event Catalog]] (cross-references) |
| Create visual architecture models | High | [[Canvas Integration]] (canvas-to-vault) |
| Maintain documentation completeness | Medium | [[Documentation Hub]] (undocumented badges) |
| Conduct focused domain decomposition sessions | Medium | [[Session Workspaces]] |

### Success Criteria

- All domain events registered with definitions, subscriptions, and cross-references
- Undocumented entities flagged and systematically resolved
- Canvas diagrams converted to structured vault documentation
- Domain boundaries clearly delineated across 15 bounded contexts
- Event flows traceable from source actor through services to target systems

## Jobs To Be Done

- Register domain events using Event Catalog tabs (domain, service, event, flow, actor, system, product)
- Define event subscriptions and contracts with structured definitions
- Map domain boundaries using the 15 bounded contexts as organizational anchors
- Cross-reference events to flows, systems, and actors for full traceability
- Create visual architecture using Canvas Integration (Obsidian .canvas → vault notes with hierarchy detection)
- Conduct domain decomposition in Session Workspaces with intent, execution tasks, and reflection
- Audit documentation completeness using undocumented badges and health checks

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Architecture docs drift from implementation | Critical | Periodic manual audits | [[Documentation Hub]] (auto-normalize frontmatter, undocumented badges) ✓ |
| No central event registry | Critical | Scattered wiki pages | [[Event Catalog]] (100+ events, 15 categories, 15 bounded contexts) ✓ |
| Visual models disconnected from documentation | High | Manually duplicate content | [[Canvas Integration]] (canvas parser, node→note mapping) ✓ |
| Cross-references break or go stale | High | Manual link maintenance | [[Event Catalog]] (structured cross-references) ✓ |
| Domain decomposition sessions lose focus | Medium | Unstructured meetings | [[Session Workspaces]] (intent, execution tasks, reflection) ✓ |
| No way to see what's undocumented | Medium | Spreadsheet tracking | [[Documentation Hub]] (undocumented badges) ✓ |

## What Flowti Delivers

- **Event Catalog** — Central hub for 100+ domain events with subscriptions, definitions, and cross-references to flows/systems/actors. 15 event categories across 15 bounded contexts. CRUD operations via dedicated tabs (Domains, Services, Events, Flows, Systems, Actors, Products) ✓
- **Documentation Hub** — File-driven entities with auto-normalized frontmatter. Undocumented badges provide immediate visibility into documentation gaps. Full CRUD via Event Catalog tabs ✓
- **Canvas Integration** — Canvas parser with node→note mapping, hierarchy detection (flat/nested/grouped), target folder configuration, DX Hub integration, and saved configs. Converts visual architecture diagrams into structured vault notes ✓
- **Session Workspaces** — Intentional execution environment for domain decomposition sessions with 6-state lifecycle, intent setting, and reflection journaling ✓
- **Hubs Framework** — BaseHubView shell with tab bars and split layouts for side-by-side entity comparison and cross-referencing ✓

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| event-catalog | Heavy | Event registration, subscriptions, definitions, cross-references |
| documentation | Heavy | Entity management, auto-normalize, undocumented badges |
| hub | Heavy | Tab navigation, split layouts for modeling |
| canvas | Heavy | Visual architecture, canvas-to-vault import |
| session | Moderate | Domain decomposition sessions |
| data-exchange | Light | Export architecture artifacts |
| inbox | Light | Change notifications |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Model Domain Boundaries]]
- [[JTBD - Register Domain Events]]
- [[JTBD - Create Visual Architecture Models]]
- [[JTBD - Audit Documentation Completeness]]

### Features Used

- [[Event Catalog]]
- [[Documentation Hub]]
- [[Canvas Integration]]
- [[Session Workspaces]]
- [[Hubs]]

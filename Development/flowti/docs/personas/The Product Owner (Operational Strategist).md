---
type: Persona
stage: done
description: "Owns product direction, backlog clarity, and stakeholder alignment"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
roles:
  - user
related_domains:
  - session
  - hub
  - documentation
  - event-catalog
  - inbox
related_features:
  - Session Workspaces
  - Hubs
  - Event Catalog
  - Documentation Hub
  - Inbox
---
# The Product Owner (Operational Strategist)

## Identity

### Name & Role

The Product Owner — Operational Strategist who translates vision into structured, traceable deliverables.

### Archetype

Owns product direction, backlog clarity, and stakeholder alignment. Bridges the gap between business intent and development execution through structured documentation and session-driven planning.

### Quote

> "If the team can't trace a feature back to a user need, we haven't done our job yet."

### Profile Summary

A product-minded leader who maintains backlog clarity, connects requirements to user value, and ensures every deliverable traces back to a strategic intent. Uses Flowti's Session Workspaces for sprint planning rituals, the Event Catalog for traceability across domain boundaries, and the Documentation Hub for structured product documentation. Relies on Inbox notifications to stay aware of system changes without constant manual checking.

## Core Goals

- Translate vision into deliverables
- Manage backlog with clarity
- Align stakeholders around shared understanding
- Reduce ambiguity for developers
- Ensure traceability from vision to implementation

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Maintain structured, prioritized backlog | Critical | [[Session Workspaces]], [[Documentation Hub]] |
| Connect requirements to user value | Critical | [[Event Catalog]], [[Documentation Hub]] |
| Ensure traceability (Vision → Feature → PBI) | High | [[Event Catalog]] (cross-references) |
| Reduce ambiguity for development teams | High | [[Documentation Hub]] (entity definitions) |
| Track sprint planning and review sessions | Medium | [[Session Workspaces]] (intent, execution tasks) |
| Stay informed of system changes | Medium | [[Inbox]] (notifications) |

### Success Criteria

- Every feature traces back to a documented domain event and user need
- Sprint planning sessions captured with intent, energy, and reflection
- Product documentation auto-normalized and consistently structured
- Undocumented entities visibly flagged for attention
- Stakeholder alignment visible through shared event definitions

## Jobs To Be Done

- Maintain structured backlog using Session Workspaces for planning sessions with intent and execution tasks
- Connect requirements to user value via Event Catalog cross-references (events → flows → systems → actors)
- Map releases and prioritize (MoSCoW, Magic Estimation) with session-driven execution tracking
- Ensure traceability through the Event Catalog's domain/service/event/flow entity relationships
- Manage product documentation through the Documentation Hub's file-driven entities
- Monitor backlog health via Inbox notifications and unread counts in User Hub

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| User stories too vague | Critical | Repeated refinement sessions | [[Documentation Hub]] (structured entities, auto-normalize) ✓ |
| Disconnect between research and backlog | High | Manual cross-referencing | [[Event Catalog]] (cross-references, subscriptions) ✓ |
| Lack of structured documentation | High | Ad-hoc wiki pages | [[Documentation Hub]] (Domains, Services, Events, Flows, Products) ✓ |
| Poor release transparency | High | Status meetings | [[Session Workspaces]] (session statistics in User Hub) ✓ |
| No visibility into what's undocumented | Medium | Manual audits | [[Event Catalog]] (undocumented badges) ✓ |
| Context lost between planning sessions | Medium | Personal notes | [[Session Workspaces]] (reflection journaling, closure ritual) ✓ |

## What Flowti Delivers

- **Session Workspaces** — Sprint planning as intentional sessions with 6-state lifecycle, intent setting, execution tasks, and reflection journaling. 8 session types support different planning modes ✓
- **Event Catalog** — Traceability across 100+ domain events with cross-references to flows, systems, and actors. 15 bounded contexts provide structural clarity ✓
- **Documentation Hub** — File-driven entities (Domains, Services, Events, Flows, Systems, Actors, Products) with auto-normalized frontmatter and CRUD operations ✓
- **Inbox/Notifications** — 6 source events with mark read/dismiss/clear, 500-item cap, and unread count in User Hub for passive awareness ✓
- **Hubs Framework** — Tab-based navigation with split layouts for reviewing documentation alongside backlog items ✓
- **Undocumented Badges** — Visual indicators showing which entities lack documentation, driving completeness ✓

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| session | Heavy | Sprint planning, review sessions, reflection |
| documentation | Heavy | Product docs, entity management |
| event-catalog | Heavy | Traceability, cross-references |
| hub | Moderate | Navigation, tab workflows |
| inbox | Moderate | Change notifications, awareness |
| user-hub | Light | Session statistics, settings |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Maintain Structured Backlog]]
- [[JTBD - Ensure Traceability]]
- [[JTBD - Manage Product Documentation]]
- [[JTBD - Plan and Review Sprints]]

### Features Used

- [[Session Workspaces]]
- [[Event Catalog]]
- [[Documentation Hub]]
- [[Hubs]]
- [[Inbox]]
- [[User Hub]]

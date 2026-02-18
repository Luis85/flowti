---
type: Learning
id: L-06
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 3
domain: architecture
tags:
  - learning
  - architecture
  - events
---

# L-06: Direct CRUD for configuration data

Template management uses direct methods (no events) — matching the DataExchange saved config pattern. Configuration artifacts (templates, saved configs) don't need event-driven CRUD; they are not domain actions.

## Pattern

- **Domain actions** (session lifecycle, subscriptions) flow through the EventBus
- **Configuration CRUD** (templates, saved configs, presets) can use direct service methods
- The distinction: domain actions are meaningful business events; configuration is settings management

## When to Apply

- When adding CRUD for user-managed presets, templates, or saved configurations
- When the operation has no downstream subscribers that need notification

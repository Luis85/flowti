---
type: Persona
stage: done
description: "Non-technical user who builds workflows using low-code configuration within Obsidian"
plugin: "[[Development/flowti/README|README]]"
domain: Flowti
roles:
  - user
related_domains:
  - data-exchange
  - installer
  - hub
  - subscription
  - canvas
  - event-catalog
related_features:
  - Data Exchange Hub
  - Installer
  - Event Catalog
  - Canvas Integration
---
# Citizen Developer

## Identity

### Name & Role

Citizen Developer — the non-technical builder who creates workflows using guided wizards and visual configuration.

### Archetype

A non-technical user who builds and customizes workflows using low-code or no-code tools within the Obsidian vault. The Citizen Developer relies on Flowti's guided wizards (import, export, pipeline builder) and visual configuration (event subscriptions, folder filters) rather than writing code. Their primary goal is to automate repetitive documentation tasks and create structured data flows without developer assistance.

### Quote

> "I don't write code, but I can build a pipeline that saves my team hours every week."

### Profile Summary

The Citizen Developer sits between the Knowledge Worker and the Developer. They don't write TypeScript or model domain events, but they configure data pipelines, set up event subscriptions, customize import/export workflows, and use the Installer wizard to scaffold new vault structures. They value clear error messages, step-by-step guidance, pre-built templates, and visual configuration over code-based setup. Flowti's guided UI workflows — from the 4-page first-run Installer to the DX Hub's pipeline builder — are their primary tools.

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Automate repetitive data tasks without coding | Critical | [[Data Exchange Hub]] (pipelines, CSV import/export) |
| Set up vault structure without technical help | Critical | [[Installer]] (4-page wizard, PARA scaffolding) |
| Configure event subscriptions visually | High | [[Event Catalog]] (subscription management) |
| Import external data with guided workflows | High | [[Data Exchange Hub]] (CSV import with merge keys, canvas import) |
| Build reusable export templates | High | [[Data Exchange Hub]] (CSV/JSON/Markdown export with formulas) |
| Convert visual diagrams to structured notes | Medium | [[Canvas Integration]] (canvas parser, saved configs) |

### Success Criteria

- Data pipelines configured and running without developer assistance
- Vault structure scaffolded via Installer wizard on first run
- Event subscriptions set up through visual configuration
- Import/export workflows saved as reusable configurations
- Clear error messages guide recovery when something goes wrong
- Canvas diagrams converted to notes with saved configuration presets

## Jobs To Be Done

- Set up vault structure using the 4-page Installer wizard with PARA folder scaffolding and user profile creation
- Configure CSV import pipelines using the Data Exchange Hub's guided workflow with merge keys for deduplication
- Build export templates for CSV/JSON/Markdown with formula support via DX Hub
- Set up event subscriptions visually through Event Catalog subscription management
- Import Obsidian .canvas files into structured vault notes using Canvas Integration's saved configs
- Create multi-source data pipelines with aggregated results through the DX Hub pipeline builder
- Customize folder filters and target configurations without editing code

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Complex setup requires developer help | Critical | Wait for a developer | [[Installer]] (4-page wizard, idempotent, extensible) ✓ |
| Data import requires scripting knowledge | Critical | Manual data entry | [[Data Exchange Hub]] (guided CSV import, merge keys) ✓ |
| No visual way to configure event routing | High | Edit YAML manually | [[Event Catalog]] (subscription management tabs) ✓ |
| Export formats require code to customize | High | Ask developer for exports | [[Data Exchange Hub]] (CSV/JSON/Markdown export with formulas) ✓ |
| Error messages are cryptic and unhelpful | High | Trial and error | [[Data Exchange Hub]] (per-item error resilience) ✓ |
| Canvas diagrams can't become structured data | Medium | Manual recreation | [[Canvas Integration]] (canvas parser, hierarchy detection, saved configs) ✓ |
| No templates for common tasks | Medium | Start from scratch each time | [[Installer]] (PARA scaffolding), [[Data Exchange Hub]] (saved pipeline configs) ✓ |

## What Flowti Delivers

- **Installer** — 4-page first-run wizard with PARA folder scaffolding, user profile creation, extensible step pipeline, and idempotent execution. Guides vault setup without technical knowledge ✓
- **Data Exchange Hub** — Guided CSV import with merge keys, CSV/JSON/Markdown export with formula support, multi-source pipelines with aggregated results, canvas import with saved configs, Base file integration. 7 tabs for different operations ✓
- **Event Catalog** — Visual subscription management, event browsing across 15 categories, cross-reference navigation. No code required to explore and configure event routing ✓
- **Canvas Integration** — Canvas parser with node→note mapping, hierarchy detection (flat/nested/grouped), target folder configuration, and saved configs for reusable import presets ✓
- **Hubs Framework** — Tab-based navigation with clear visual hierarchy. BaseHubView shell provides consistent UI patterns across all hubs ✓
- **Error Resilience** — Per-item error handling in Signal sync and DX Hub operations means one bad record doesn't stop the entire pipeline ✓

## Needs

- Guided UI workflows with clear step-by-step prompts
- Visual configuration over code-based setup
- Pre-built templates for common tasks (imports, exports, session types)
- Clear error messages and recovery paths when something goes wrong
- Saved configurations for repeatable workflows
- Consistent UI patterns across all Flowti surfaces

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| data-exchange | Heavy | Pipeline building, import/export configuration |
| installer | Heavy | First-run setup, vault scaffolding |
| hub | Heavy | Navigation, tab-based workflows |
| canvas | Moderate | Canvas-to-vault import with saved configs |
| event-catalog | Moderate | Subscription management, event browsing |
| subscription | Moderate | Event routing configuration |
| user-hub | Light | Profile, settings |
| inbox | Light | Notification awareness |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Automate Data Tasks Without Coding]]
- [[JTBD - Set Up Vault Structure]]
- [[JTBD - Configure Event Subscriptions]]
- [[JTBD - Import and Transform Data]]

### Features Used

- [[Data Exchange Hub]]
- [[Installer]]
- [[Event Catalog]]
- [[Canvas Integration]]
- [[Hubs]]

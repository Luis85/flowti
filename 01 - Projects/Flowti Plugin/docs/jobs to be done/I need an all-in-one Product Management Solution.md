---
type: Job to be Done
persona: "[[Strategic Systems Builder]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Unified product management solution integrating requirements, backlog, execution, and delivery"
related_features: [Session Workspaces, Event Catalog, Data Exchange Hub, Hubs, Signal Integration, Documentation Hub]
priority: high
---

## 1. Job Statement

**When** managing a product end-to-end,
**I need to** have an integrated solution that connects requirements, backlog, execution, and delivery in one environment,
**so that** context is never lost and traceability is built-in.

### Job Context
Product management today is fragmented across multiple tools: requirements in Confluence, backlog in Jira or Azure DevOps, execution in project management tools, documentation in wikis, and strategy in slide decks. Every tool boundary is a context gap where information is lost, duplicated, or contradicted. Strategic systems builders need a single environment where the entire product lifecycle — from user research through delivery and retrospective — is connected, traceable, and queryable. This meta-job encompasses many individual jobs and is the north star for Flowti's integrated product management vision.

### Job Category
- **Type:** functional
- **Frequency:** daily
- **Criticality:** blocking

## 2. Scope

### In Scope
- Unified environment for all product management activities
- Requirements management with traceability to user needs (JTBDs)
- Backlog management with prioritization and dependency tracking
- Session-based execution with intent, tasks, and reflection
- Delivery tracking with progress visibility and risk surfacing
- Documentation management for all entity types (domains, services, events, flows, systems, actors, products)
- External tool integration for teams that straddle multiple platforms
- Data import/export for interoperability and stakeholder communication
- Inbox and notification system for activity awareness
- First-run setup and vault scaffolding for immediate productivity

### Out of Scope
- Replacing specialized development tools (IDEs, CI/CD pipelines, version control)
- Real-time multi-user collaboration (Obsidian limitation)
- Financial and budgeting management

### Sub-Jobs (Referenced JTBDs)

This meta-JTBD encompasses the following individual jobs:

| Sub-Job | Relationship |
|---------|-------------|
| [[I need to manage a product]] | core |
| [[I need to manage a product backlog]] | core |
| [[I need to manage a project]] | core |
| [[I need to manage a RAID Log]] | supporting |
| [[I need to document Requirements]] | core |
| [[I need to document System Design, Service Design, Product Design, and Software Design]] | core |
| [[I need to document my components so that I can provide a library to my stakeholders]] | supporting |
| [[I need to structure and manage my researched Jobs to be done]] | core |
| [[I need to sync my Vault with Azure DevOps Boards]] | supporting |
| [[I need to track something]] | core |
| [[I need to present my created content]] | supporting |
| [[I need to distribute my created content]] | supporting |
| [[I need to manage something]] | foundational |
| [[I need to design a flow]] | supporting |
| [[I need to manage data-quality]] | supporting |

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | A single vault supports the full product management lifecycle from research to delivery | yes |
| 2 | Traceability exists from user need (JTBD) → requirement → PBI → execution task → delivery | yes |
| 3 | Context is preserved across lifecycle stages without manual duplication | yes |
| 4 | All entity types are documented, cross-referenced, and queryable | yes |
| 5 | External tool data (Azure DevOps) syncs into the vault seamlessly | yes |
| 6 | New users are productive within one session via the Installer and onboarding flow | yes |
| 7 | Stakeholders can consume vault content via exports without needing Obsidian | yes |
| 8 | Activity intelligence surfaces what needs attention without manual triage | yes |

## 4. Current Alternatives

### Workarounds
- Tool sprawl: Jira + Confluence + Miro + Notion + Slack + spreadsheets
- Manual cross-referencing between disconnected tools
- Context loss at every tool boundary requiring duplicate documentation
- "Source of truth" debates because no single system has the full picture

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Session Workspaces]] | primary | partial |
| [[Event Catalog]] | primary | full |
| [[Data Exchange Hub]] | primary | partial |
| [[Hubs]] | primary | partial |
| [[Signal Integration]] | primary | partial |
| [[Documentation Hub]] | primary | partial |
| [[Installer]] | supporting | full |
| [[Canvas Integration]] | supporting | partial |
| [[Inbox]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Product Lifecycle Flow]] | primary |
| [[Session Lifecycle Flow]] | primary |
| [[Backlog Refinement Flow]] | supporting |
| [[Azure DevOps Sync Flow]] | supporting |
| [[Content Export Flow]] | supporting |

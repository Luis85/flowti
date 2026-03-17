---
type: Job to be Done
persona: "[[Delivery Manager (Systems Orchestrator)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: validated
description: "Synchronize Azure DevOps work items into Obsidian vault notes for unified project management"
related_features: [Signal Integration, Data Exchange Hub]
priority: high
---

## 1. Job Statement

**When** managing a software project across Azure DevOps and Obsidian,
**I need to** sync work items into my vault,
**so that** I have a single source of truth for project planning and execution.

### Job Context
Teams using Azure DevOps for delivery tracking and Obsidian for knowledge management face a split-brain problem: work items live in one system while plans, notes, and architectural decisions live in another. Without synchronization, status updates require manual cross-referencing, and context is lost between tools. This becomes urgent during sprint planning, standups, and retrospectives when up-to-date work item data is needed alongside vault documentation.

### Job Category
- **Type:** functional
- **Frequency:** daily
- **Criticality:** blocking

## 2. Scope

### In Scope
- Inbound sync of Azure DevOps work items to vault notes
- PAT-based authentication with Azure DevOps
- Conflict resolution strategies (vault-wins, remote-wins, merge)
- Work item field mapping to frontmatter properties
- Incremental sync (only changed items)

### Out of Scope
- Outbound sync from vault to Azure DevOps (see future JTBD)
- GitHub Issues or Jira integration (see separate signal integration JTBDs)
- Work item creation from within Obsidian

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Work items from Azure DevOps appear as vault notes with correct frontmatter | yes |
| 2 | Sync completes within 30 seconds for up to 500 work items | yes |
| 3 | Conflict strategy is applied correctly when both sides change | yes |
| 4 | PAT authentication succeeds without exposing credentials in vault files | yes |
| 5 | Incremental sync only updates changed items since last sync | yes |

## 4. Current Alternatives

### Workarounds
- Manually copying work item details into Obsidian notes
- Using Azure DevOps browser alongside Obsidian with no data linkage
- Exporting CSV from Azure DevOps and manually importing into vault

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Signal Integration]] | primary | full |
| [[Data Exchange Hub]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Azure DevOps Sync Flow]] | primary |
| [[Data Import Flow]] | supporting |

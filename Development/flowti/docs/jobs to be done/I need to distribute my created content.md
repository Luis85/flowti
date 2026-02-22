---
type: Job to be Done
persona: "[[Strategic Systems Builder]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: validated
description: "Export and distribute vault content to external systems and formats"
related_features: [Data Exchange Hub]
priority: medium
---

## 1. Job Statement

**When** I've created structured content in my vault,
**I need to** distribute it as CSV/JSON/Markdown exports,
**so that** stakeholders and external systems can consume it.

### Job Context
Vault content — event definitions, domain models, flow documentation — is valuable beyond Obsidian. Stakeholders who don't use Obsidian need access to this data in standard formats. External systems (dashboards, wikis, CI/CD pipelines) need machine-readable exports. Without structured export capabilities, content creators resort to manual copy-paste or screenshots, losing metadata and traceability in the process.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** important

## 2. Scope

### In Scope
- Exporting vault content to CSV, JSON, and Markdown formats
- Formula support in exports (computed fields, aggregations)
- Multi-source export pipelines (combining data from different entity types)
- Selective export (filtering by type, domain, status)
- Preserving frontmatter metadata in exports

### Out of Scope
- Publishing to web (static site generation)
- Real-time sync with external systems (see [[I need to sync my Vault with Azure DevOps Boards]])
- Import workflows (see data import JTBD)

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Exports produce valid CSV/JSON/Markdown files | yes |
| 2 | Formula fields are evaluated and included in export output | yes |
| 3 | Export can filter by entity type, domain, or custom criteria | yes |
| 4 | Exported data preserves all frontmatter metadata | yes |
| 5 | Multi-source pipelines combine data from 2+ entity types correctly | yes |

## 4. Current Alternatives

### Workarounds
- Manual copy-paste from Obsidian to spreadsheets or documents
- Dataview query results copied as plain text
- Screenshots of vault content shared via chat or email

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Data Exchange Hub]] | primary | full |

### Flow Links

| Flow | Role |
|------|------|
| [[Content Export Flow]] | primary |
| [[Data Pipeline Flow]] | supporting |

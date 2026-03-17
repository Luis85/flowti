---
type: Job to be Done
persona: "[[The Product Owner (Operational Strategist)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Present vault content to stakeholders in consumable formats"
related_features: [Data Exchange Hub]
priority: low
---

## 1. Job Statement

**When** sharing progress or documentation with stakeholders,
**I need to** present my vault content in consumable formats (exports, reports, slides),
**so that** non-vault users can review and provide feedback.

### Job Context
Vault knowledge is powerful but locked inside Obsidian. Stakeholders who do not use the vault — executives, clients, external partners — need to consume this content in familiar formats like CSV, JSON, Markdown reports, or slide decks. Without export and presentation capabilities, product owners resort to manual copy-paste, screenshots, or maintaining parallel documentation. This is most urgent before stakeholder reviews, board meetings, and external delivery milestones.

### Job Category
- **Type:** functional
- **Frequency:** ad-hoc
- **Criticality:** important

## 2. Scope

### In Scope
- Exporting vault content to CSV, JSON, and Markdown formats
- Formatting exports with applied formulas and computed fields
- Selecting and filtering content for targeted presentations
- Generating summary reports from structured vault data
- Sharing exported artifacts with stakeholders

### Out of Scope
- Real-time collaborative editing with stakeholders (out of Obsidian scope)
- Content distribution and publishing workflows (see [[I need to distribute my created content]])
- Slide deck generation from vault notes (future capability)

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Vault content can be exported to CSV, JSON, and Markdown with one action | yes |
| 2 | Exports preserve computed fields and formula results | yes |
| 3 | Exported content is readable by non-vault stakeholders without context loss | yes |
| 4 | Export scope can be filtered to specific entities or domains | yes |
| 5 | Stakeholders can provide feedback on exported content | no |

## 4. Current Alternatives

### Workarounds
- Manual copy-paste from vault notes into documents or emails
- Screenshots of Obsidian views shared in Slack or Teams
- Maintaining parallel documentation in Confluence or Google Docs

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Data Exchange Hub]] | primary | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Content Export Flow]] | primary |
| [[Stakeholder Review Flow]] | supporting |

---
type: Job to be Done
persona: "[[Strategic Systems Builder]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Ensure data quality across vault content with validation, normalization, and health checks"
related_features: [Data Exchange Hub, Event Catalog]
priority: medium
---

## 1. Job Statement

**When** maintaining a large vault,
**I need to** tools to validate frontmatter conformance, detect missing fields, and normalize inconsistencies,
**so that** the data stays trustworthy and queryable.

### Job Context
As a vault grows, data quality degrades. Frontmatter fields drift from their schemas, required fields go missing, naming conventions diverge, and broken links accumulate. Without systematic validation and normalization, queries return incomplete or incorrect results, undermining trust in the vault as a source of truth. This job becomes critical once the vault exceeds a few hundred structured notes, where manual auditing is no longer feasible.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** important

## 2. Scope

### In Scope
- Validating frontmatter conformance against type-specific schemas
- Detecting missing required fields across entity types
- Normalizing inconsistent field values (casing, naming conventions)
- Identifying broken or orphaned links
- Reporting data quality metrics and trends

### Out of Scope
- Content quality assessment (writing quality, completeness of prose)
- Automated fix/repair of data quality issues (report-only for now)
- External data source validation (API health checks)

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Frontmatter validation catches missing required fields | yes |
| 2 | Schema conformance is checked against type-specific rules | yes |
| 3 | Data quality report shows percentage of conforming entities | yes |
| 4 | Broken links are detected and listed for remediation | yes |
| 5 | Normalization suggestions are generated for inconsistent values | yes |

## 4. Current Alternatives

### Workarounds
- Manual audits by reviewing notes one at a time
- Obsidian Bases providing partial visibility into frontmatter fields
- Dataview queries to spot-check specific fields (fragile, not comprehensive)

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Data Exchange Hub]] | supporting | partial |
| [[Event Catalog]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Data Quality Audit Flow]] | primary |
| [[Normalization Flow]] | supporting |

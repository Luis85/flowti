---
type: AuditTemplate
domain: Flowti
stage: draft
owner:
created_at:
last_reviewed_at:
tags:
  - template
  - audit
  - documentation
  - review
---

# Documentation Audit Review Template

> A structured shape for conducting and recording periodic audits of the documentation system. The audit ensures the documentation remains a living organism — current, connected, conforming, and complete.

---

# How to Use This Template

1. Create a new file per audit: `Documentation Audit YYYY-MM-DD.md`
2. Replace the frontmatter `type: AuditTemplate` with `type: DocumentationAudit` in your instance
3. Work through each section systematically — use the checklists and scoring tables
4. The Coverage Matrix (Section 2) is the core deliverable — fill it completely
5. Sections 3–8 dive into specific quality dimensions
6. Section 9 (Findings) captures new debt items; Section 10 (Actions) assigns remediation
7. Compare scores against the previous audit to track trends

---

# Audit Instance Frontmatter Schema

Every audit instance file must use this frontmatter shape:

```yaml
---
type: DocumentationAudit
domain: Flowti
stage: done
plugin: "[[Development/flowti/README|README]]"
audit_date: # YYYY-MM-DD
auditor:
previous_audit: # [[Documentation Audit YYYY-MM-DD]]
scope: # full | partial
trigger: # scheduled | post-release | post-refactor | ad-hoc
doc_health_score: 0
doc_health_max: 60
doc_health_level: # critical | poor | fair | good | excellent
new_debt_items: 0
resolved_debt_items: 0
net_debt_delta: 0
tags:
  - audit
  - documentation
---
```

---

## 1. Audit Scope & Context

**Purpose:** Define what is being audited, why, and what has changed since the last audit.

### 1.1 Scope

- **Audit Type:** <!-- full system | specific domain | specific doc type -->
- **Directories Audited:** <!-- list directories included -->
- **Trigger:** <!-- scheduled review | post-release | post-refactor | new templates added | ad-hoc -->

### 1.2 Changes Since Last Audit

<!-- What has changed in the documentation system since the previous audit? New templates, new doc types, structural changes, new features? -->

| Change | Date | Impact |
|--------|------|--------|
| | | |

### 1.3 Audit Objectives

<!-- What specific questions is this audit trying to answer? -->

- [ ]
- [ ]
- [ ]

---

## 2. Coverage Matrix

**Purpose:** The core deliverable. Quantify how completely each documentation area covers its expected content. This is the vital signs panel of the documentation organism.

### 2.1 Document Type Coverage

| Document Type | Template Exists | Total Files | With Frontmatter | With `type:` Field | With Body Content | Coverage % |
|---------------|----------------|-------------|-------------------|-------------------|-------------------|-----------|
| Domain | | | | | | |
| Feature / PRD | | | | | | |
| Flow | | | | | | |
| Component | | | | | | |
| Decision (ADR) | | | | | | |
| Job to Be Done | | | | | | |
| Persona | | | | | | |
| User Story | | | | | | |
| Product Backlog Item | | | | | | |
| Technical Debt | | | | | | |
| View (Sitemap) | | | | | | |
| Knowledgebase | | | | | | |
| Architecture Doc | | | | | | |
| Idea | | | | | | |

### 2.2 Cross-Reference Coverage

| Relationship | Expected Links | Verified Links | Broken Links | Coverage % |
|-------------|---------------|----------------|--------------|-----------|
| Feature → Domain | | | | |
| Flow → Domain | | | | |
| Flow → Events | | | | |
| Component → Source | | | | |
| Component → Parent | | | | |
| JTBD → Persona | | | | |
| JTBD → Feature | | | | |
| User Story → Feature | | | | |
| User Story → Persona | | | | |
| Debt → PRD Owner | | | | |
| Decision → Related ADRs | | | | |

### 2.3 Aggregate Metrics

| Metric | Count | Previous Audit | Delta |
|--------|-------|---------------|-------|
| Total markdown files | | | |
| Files with complete frontmatter | | | |
| Files with `type:` field | | | |
| Files with body content (>10 lines) | | | |
| Total wikilinks | | | |
| Broken wikilinks | | | |
| Empty/stub files | | | |
| .base database files | | | |

---

## 3. Frontmatter Conformance

**Purpose:** Verify that documents conform to the data shapes defined by their templates. Conformance is what makes the documentation queryable and self-documenting.

### 3.1 Schema Compliance by Type

For each document type, check whether instances include the required frontmatter fields defined in their template:

| Document Type | Required Fields | Files Checked | Fully Compliant | Partially Compliant | Non-Compliant |
|---------------|----------------|---------------|-----------------|---------------------|---------------|
| | | | | | |

### 3.2 Common Violations

| Violation | Occurrences | Severity | Fix Effort |
|-----------|-------------|----------|-----------|
| Missing `type:` field | | high | small |
| Missing `stage:` field | | medium | small |
| Missing `domain:` field | | medium | small |
| Missing `description:` field | | low | small |
| Malformed frontmatter YAML | | high | small |
| `type:` value not in Data Dictionary | | medium | medium |

### 3.3 Data Dictionary Alignment

- [ ] All `type:` values used in files are defined in Data Dictionary
- [ ] All frontmatter schemas in Data Dictionary match their templates
- [ ] No undocumented `type:` values in the wild
- [ ] Property reference is current with all frontmatter fields in use

---

## 4. Content Quality

**Purpose:** Assess whether documents contain useful, current content — not just correct metadata. A well-formed stub is still a gap.

### 4.1 Content Depth by Area

| Area | Files | Stubs (<10 lines body) | Partial (10–50 lines) | Complete (50+ lines) | Stub % |
|------|-------|------------------------|----------------------|---------------------|--------|
| domains/ | | | | | |
| features/ | | | | | |
| flows/ | | | | | |
| components/ | | | | | |
| decisions/ | | | | | |
| jobs to be done/ | | | | | |
| personas/ | | | | | |
| user-stories/ | | | | | |
| debt/ | | | | | |
| knowledgebase/ | | | | | |
| ideas/ | | | | | |

### 4.2 Staleness Assessment

| Document | Last Modified | Days Since Update | Stale? | Action |
|----------|--------------|-------------------|--------|--------|
| Backend Architecture.md | | | | |
| Frontend Architecture.md | | | | |
| Event Catalog.md | | | | |
| Data Dictionary.md | | | | |
| Testplan and Teststrategy.md | | | | |
| Development Lifecycle.md | | | | |

### 4.3 Empty & Orphaned Files

| File | Issue | Recommendation |
|------|-------|---------------|
| | empty / orphaned / obsolete | populate / delete / archive |

---

## 5. Event Catalog Integrity

**Purpose:** The Event Catalog is the central nervous system. Verify it reflects reality.

### 5.1 Event Counts

| Metric | Catalog Count | Source Count | Delta |
|--------|--------------|-------------|-------|
| Total events | | | |
| Infrastructure events | | | |
| Domain events | | | |
| Event categories | | | |
| Domain services | | | |

### 5.2 Phantom Events

Events referenced in documentation that do not exist in the catalog or source code:

| Event Name | Referenced In | Status |
|-----------|--------------|--------|
| | | phantom / renamed / planned |

### 5.3 Undocumented Events

Events in source code that are not in the Event Catalog:

| Event Name | Source File | Status |
|-----------|------------|--------|
| | | missing / intentionally excluded |

---

## 6. Template Effectiveness

**Purpose:** Evaluate whether templates are achieving their goal — guiding content creation toward conforming data shapes.

### 6.1 Template Inventory

| Template | Target Doc Type | Instances Created | Avg. Compliance | Effective? |
|----------|----------------|-------------------|-----------------|-----------|
| PRD Template | Feature | | | |
| Domain Documentation Template | Domain | | | |
| Three Amigos Session Template | ReviewSession | | | |
| Product Backlog Item Template | ProductBacklogItem | | | |
| Persona Template | Persona | | | |
| JTBD Template | Job to be Done | | | |
| User Story Template | UserStory | | | |
| Architecture Stability Index | ASI | | | |
| Domain Book Template | Book | | | |
| Product Service Book Template | Book | | | |

### 6.2 Templates Without Instances

<!-- Templates that exist but have zero or very few instances created from them. These may need promotion or reconsideration. -->

| Template | Reason for Low Adoption |
|----------|------------------------|
| | |

### 6.3 Doc Types Without Templates

<!-- Document types that exist in the wild but have no template to guide their creation. -->

| Doc Type | Instance Count | Template Needed? |
|----------|---------------|-----------------|
| | | yes / no |

---

## 7. Technical Debt Health

**Purpose:** Review the documentation-related technical debt register. Debt items are the immune system's memory — they track known issues so they can be resolved systematically.

### 7.1 Debt Summary

| Metric | Count | Previous Audit | Delta |
|--------|-------|---------------|-------|
| Total debt items | | | |
| Open | | | |
| Resolved | | | |
| High severity open | | | |
| Documentation category | | | |
| Architecture category | | | |

### 7.2 New Debt Items Created by This Audit

| ID | Title | Severity | Category |
|----|-------|----------|----------|
| | | | |

### 7.3 Debt Items Resolved Since Last Audit

| ID | Title | Resolution Date |
|----|-------|----------------|
| | | |

### 7.4 Oldest Open Debt

| ID | Title | Age (days) | Blocked By |
|----|-------|-----------|-----------|
| | | | |

---

## 8. Database View Health

**Purpose:** Verify that `.base` database views return meaningful results. Views are the documentation system's query layer — broken views mean broken navigation.

### 8.1 View Inventory

| View File | Target Type | Expected Results | Actual Results | Healthy? |
|-----------|------------|-----------------|----------------|----------|
| 01 - Jobs to be done.base | Job to be Done | | | |
| 02 - Features.base | Feature | | | |
| 03 - User Stories.base | UserStory | | | |
| 04 - Sitemap.base | View | | | |
| 05 - Technical Debt.base | TechDebt | | | |
| 06 - Flows.base | Flow | | | |
| 07 - Backlog.base | ProductBacklogItem | | | |
| 08 - Components.base | Component | | | |
| 09 - Decisions.base | DecisionNote | | | |
| 10 - Ideas.base | Idea | | | |
| Component Library.base | Component | | | |

---

## 9. Documentation Health Score

**Purpose:** Quantify the overall health of the documentation system into a single comparable score. Track trends across audits.

### 9.1 Scoring Dimensions

| # | Dimension | Weight | Score (0–5) | Weighted |
|---|-----------|--------|-------------|----------|
| A | **Coverage Completeness** — % of expected doc types with content | x2 | | |
| B | **Frontmatter Conformance** — % of files matching their template schema | x2 | | |
| C | **Content Depth** — % of files with substantive body content (>10 lines) | x2 | | |
| D | **Cross-Reference Integrity** — % of wikilinks that resolve | x1.5 | | |
| E | **Event Catalog Accuracy** — alignment between catalog, source, and docs | x1.5 | | |
| F | **Template Effectiveness** — % of doc types with templates & compliant instances | x1 | | |
| G | **Debt Trajectory** — net debt direction (improving vs. degrading) | x1 | | |
| H | **Staleness** — % of core docs updated within acceptable window | x1 | | |
| | **Total** | **12** | | **/60** |

### 9.2 Scoring Guide

| Score | Meaning |
|-------|---------|
| 0 | Not addressed at all |
| 1 | Minimal effort, mostly gaps |
| 2 | Partial coverage, significant issues |
| 3 | Acceptable, some gaps remain |
| 4 | Good, minor improvements possible |
| 5 | Excellent, meets all expectations |

### 9.3 Health Levels

| Score Range | Level | Interpretation |
|-------------|-------|---------------|
| 0–12 | Critical | Documentation is not functional as a reference system |
| 13–24 | Poor | Major gaps prevent effective use |
| 25–36 | Fair | Usable but with significant blind spots |
| 37–48 | Good | Reliable reference with minor gaps |
| 49–60 | Excellent | Living organism functioning as designed |

### 9.4 YAML Tracking Block

```yaml
audit_scores:
  coverage_completeness: 0
  frontmatter_conformance: 0
  content_depth: 0
  crossref_integrity: 0
  event_catalog_accuracy: 0
  template_effectiveness: 0
  debt_trajectory: 0
  staleness: 0
  total: 0
  max: 60
  health_level: critical
```

### 9.5 Trend Tracking

| Audit Date | Total Score | Level | Net Debt Delta | Key Changes |
|-----------|-------------|-------|----------------|-------------|
| | | | | |
| | | | | |

---

## 10. Action Items

**Purpose:** Convert findings into assigned, trackable remediation work.

### 10.1 Immediate Actions (This Sprint)

| # | Action | Owner | Deadline | Debt Item |
|---|--------|-------|----------|-----------|
| 1 | | | | |

### 10.2 Short-Term Actions (Next Sprint)

| # | Action | Owner | Deadline | Debt Item |
|---|--------|-------|----------|-----------|
| 1 | | | | |

### 10.3 Medium-Term Actions (Roadmap)

| # | Action | Owner | Target | Debt Item |
|---|--------|-------|--------|-----------|
| 1 | | | | |

---

## 11. Audit Checklist

**Purpose:** Verify the audit itself is complete before publishing.

- [ ] Coverage Matrix (Section 2) fully populated
- [ ] All document types checked for frontmatter conformance
- [ ] Content depth assessed for every documentation area
- [ ] Event Catalog verified against source code
- [ ] Template effectiveness reviewed
- [ ] Technical debt register updated
- [ ] Database views spot-checked
- [ ] Health score calculated and compared to previous audit
- [ ] New debt items created for all findings
- [ ] Action items assigned with owners and deadlines
- [ ] Audit frontmatter updated with final scores

---

## 12. Audit Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Auditor | | | yes / no |
| Documentation Owner | | | yes / no |
| Technical Lead | | | yes / no |

---

# Conceptual Summary

A Documentation Audit is the immune system's periodic scan. It exists to:
- **Detect drift** — between what the documentation claims and what actually exists
- **Measure health** — a single score that tracks whether the organism is thriving or decaying
- **Create accountability** — findings become debt items, debt items become action items, action items have owners
- **Enable trends** — comparing audits over time reveals whether investment in documentation is paying off

The audit is not a punishment — it is a health check. A declining score is a signal to invest; an improving score is evidence that the system is working.

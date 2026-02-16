---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events: []
maturity: L1
business_value: 3
implementation_cost: 4
maintenance_cost: 2
discovery_cost: 3
design_cost: 4
test_cost: 3
priority: 2
---

# Data Governance PRD

> Architecture reference: [[Data Governance]], [[Data Governance Dashboard]], [[Data Governance Snapshot]]

---

## 1. Problem Statement

As domains, entities, and events grow across the vault, there is no systematic way to enforce structural integrity, documentation completeness, or architectural discipline. Users create entities with inconsistent frontmatter, undocumented relationships, and missing required fields. Without governance, the knowledge graph degrades over time and becomes unreliable for automation and reporting.

---

## 2. Outcome

Users can define validation rulesets per domain that enforce entity type definitions, relationship constraints, event discipline, and documentation completeness. A Governance Dashboard provides system-wide visibility into structural health, and Governance Snapshots capture point-in-time reports for review cycles.

---

## 3. Scope

### In Scope
- Domain Validation Rulesets (structural, semantic, behavioral constraints)
- Governance Dashboard (system-wide health visibility)
- Governance Snapshots (point-in-time health reports)
- Entity type definitions and required field enforcement
- Relationship validation rules
- Documentation completeness scoring

### Out of Scope
- Automated remediation (future)
- Cross-vault governance
- Real-time enforcement blocking (advisory mode first)

---

## 4. UX Entry Points

- Governance Dashboard view (system hub)
- Per-domain ruleset configuration
- Snapshot generation and review

---

## 5. Functional Requirements

- [ ] Define allowed entity types per domain with required/optional fields
- [ ] Validate relationships between entities
- [ ] Enforce event naming and payload conventions
- [ ] Score documentation completeness per domain
- [ ] Display governance health on a dashboard
- [ ] Generate governance snapshots for review cycles

---

## 6. Definition of Done

All governance rulesets can be defined, validated, and reported through the dashboard. Snapshots capture point-in-time state. Advisory mode surfaces violations without blocking operations. All tests pass and `npm run build` succeeds.

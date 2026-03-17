---
type: ViewDescription
view_id: governance_dashboard
view_type: system
layout: dashboard_grid
adapter: GovernanceAdapter
status: draft
related_models:
  - Domain Maturity Model
  - Three Amigos Scoring Model
  - Feature Readiness Index
  - Domain Validation Ruleset
---

# Governance Dashboard

> The Governance Dashboard provides system-wide visibility into structural integrity, documentation quality, and architectural discipline across all domains and features.

---

# 1. Purpose

The Governance Dashboard answers:

- Are our domains healthy?
- Are our features development-ready?
- Are validation rules being respected?
- Is architectural drift increasing?
- Is documentation aligned with implementation?

It transforms governance into observable signals.

---

# 2. Scope

This is a **System Hub View**.

It aggregates:

- Domain Maturity Index (DMI)
- Three Amigos Score (TASM)
- Feature Readiness Index (FRI)
- Validation Violations
- Documentation Coverage
- Architectural Stability Index

---

# 3. Layout

Uses: `DashboardGridLayout`

```

GovernanceDashboardView  
├─ KPIRegion  
│ ├─ AvgDomainMaturity  
│ ├─ AvgThreeAmigosScore  
│ ├─ FeaturesReadyCount  
│ ├─ ValidationViolationsCount  
│ └─ ArchitectureStabilityIndex  
│  
├─ CardGridRegion  
│ ├─ DomainHealthCard  
│ ├─ FeatureReadinessCard  
│ ├─ ValidationViolationsCard  
│ ├─ DocumentationCoverageCard  
│ ├─ ArchitecturalDriftCard  
│ └─ ReviewCadenceCard

```

---

# 4. Data Sources

Aggregated from:

- Domain notes (DMI YAML block)
- PRDs (FRI YAML block)
- Three Amigos sessions (TASM YAML block)
- Domain Validation Rulesets
- Event Catalog
- Hub Registry

---

# 5. KPI Definitions

## 5.1 Average Domain Maturity

```

avg(domain_maturity.total_score)

```

Display:

- Score
- Level distribution (pie chart)
- Trend (future)

---

## 5.2 Average Three Amigos Score

```

avg(three_amigos_score.total_score)

```

Shows:

- Health level distribution
- Recent drops
- Domains with lowest scores

---

## 5.3 Features Development Ready

```

count(PRD where stage = development_ready)

```

Also:

- Features stuck in draft
- Features stuck in review

---

## 5.4 Validation Violations

Aggregates:

- entity rule violations
- event naming violations
- boundary rule violations
- missing documentation rules

Breakdown:

- Advisory
- Warning
- Strict

---

## 5.5 Architecture Stability Index

Proposed formula:

```

ASI = avg(architectural_integrity + event_discipline) / 10

```

Derived from Three Amigos scoring.

---

# 6. Cards

---

## 6.1 Domain Health Card

Shows:

| Domain | DMI | Level | Last Reviewed |
|--------|-----|-------|---------------|

Color coding:

- 🌑 Undefined
- 🌘 Emerging
- 🌓 Structured
- 🌔 Operational
- 🌕 Mature

Click → Open Domain Hub

---

## 6.2 Feature Readiness Card

Shows:

| Feature | FRI Score | Stage | Missing Gates |
|---------|-----------|-------|---------------|

Click → Open PRD

---

## 6.3 Validation Violations Card

Shows:

- Violations by domain
- Most violated rule
- Recent violations

Click → Open Validation Ruleset

---

## 6.4 Documentation Coverage Card

Measures:

- Domains with missing sections
- Entities without events
- PRDs without story map
- Missing technical reviews

---

## 6.5 Architectural Drift Card

Tracks:

- Decreasing Three Amigos scores
- Increasing validation violations
- Domains without recent review
- Orphaned entities

---

## 6.6 Review Cadence Card

Shows:

- Domains not reviewed in X days
- Features not reviewed
- Overdue Three Amigos sessions

---

# 7. Filtering & Scope

Toolbar options:

- Scope: All | Domain | Feature | Project
- Timeframe: 30d | 90d | All
- Severity Filter
- Show only degraded items

---

# 8. Interaction Model

From Dashboard:

- Click Domain → Open Domain Hub
- Click Feature → Open PRD
- Click Violation → Open Artifact
- Click Score → Show detailed breakdown modal
- Export Governance Snapshot

---

# 9. Event Model

Emits:

- `governance.view.opened`
- `governance.metric.selected`
- `governance.snapshot.exported`

Consumes:

- `domain.updated`
- `prd.updated`
- `threeAmigos.completed`
- `validation.violation.detected`
- `featureReadiness.updated`

---

# 10. Non-Functional Requirements

- Must not trigger full vault scans on each render
- Metrics must be cached
- Refresh event-driven
- Large vault support
- Virtualized tables
- Deterministic metric calculation

---

# 11. Risks

| Risk | Mitigation |
|------|------------|
| Overly bureaucratic | Keep UI visual and simple |
| Too many metrics | Start with core 5 KPIs |
| Performance degradation | Cached index model |
| False sense of safety | Highlight missing data explicitly |

---

# 12. Success Criteria

- Users check Governance Dashboard regularly
- Architectural drift detected early
- Domain maturity increases over time
- Validation violations decrease
- Features reach development_ready faster

---

# 13. Strategic Impact

The Governance Dashboard transforms Flowti into:

- A measurable operating system
- A quality monitoring platform
- A structural discipline enforcer
- A continuous improvement engine

Without it → structure exists  
With it → structure is visible, measurable, and improvable

---

# 14. Future Evolution

- Governance trend charts
- Predictive drift warnings
- Risk heatmap
- Team performance correlation
- Domain comparison view
- Auto-suggest review sessions
- Cross-domain dependency risk score
- Governance Score API


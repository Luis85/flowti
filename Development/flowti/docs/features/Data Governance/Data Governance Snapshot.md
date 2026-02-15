---
type: GovernanceSnapshot
snapshot_id:
scope: global | domain | feature | release
scope_id:
version: 1.0
created_at:
created_by:
review_cycle:
related_release:
tags:
  - governance
  - architecture
  - quality
---

# Governance Snapshot

> A consolidated structural, architectural, and documentation health report.

---

# 1. Executive Summary

## Overall Assessment

- Overall Health Level:
  - 🔴 Critical
  - 🟠 Unstable
  - 🟡 Stable
  - 🟢 Strong
  - 🟣 Excellent

- Key Observation:
- Primary Risk:
- Immediate Action Required: yes / no

---

# 2. Architecture Stability Index (ASI)

```yaml
architecture_stability_index:
  aed: 0   # architecture & event discipline (0–100)
  th: 0    # test health (0–100)
  gv: 0    # governance violations (0–100)
  di: 0    # documentation integrity (0–100)

  asi: 0   # final score (0–100)
  level: critical | unstable | stable | strong | excellent
````

### Interpretation

- Is ASI increasing or decreasing?
    
- Which component is weakest?
    
- Drift detected: yes / no
    

---

# 3. Domain Maturity Overview (DMI)

|Domain|DMI Score|Level|Last Reviewed|Trend|
|---|---|---|---|---|

### Distribution

- 🌑 Undefined:
    
- 🌘 Emerging:
    
- 🌓 Structured:
    
- 🌔 Operational:
    
- 🌕 Mature:
    

### Observations

- Domains with lowest maturity:
    
- Domains with rapid improvement:
    
- Boundary conflicts detected:
    

---

# 4. Feature Readiness Index (FRI)

|Feature|FRI Score|Stage|Missing Gates|
|---|---|---|---|

### Observations

- Features blocked in draft:
    
- Features missing technical review:
    
- Features marked development_ready but lacking documentation:
    

---

# 5. Three Amigos Health (TASM)

|Scope|Score|Level|Last Review|
|---|---|---|---|

### Pattern Analysis

- Consecutive drops:
    
- Common weak dimension:
    
- Domains/features requiring refactor:
    

---

# 6. Validation & Rule Enforcement

## Violations Summary

```yaml
validation_summary:
  advisory: 0
  warning: 0
  strict: 0
  top_violated_rule:
```

### Frequent Violations

- Rule:
    
- Domain:
    
- Severity:
    

### Boundary Violations

- Cross-domain misuse:
    
- Duplicate event semantics:
    

---

# 7. Test Health Summary

```yaml
test_health:
  total_tests:
  passing:
  failing:
  skipped:
  pass_rate_percent:
  statement_coverage_percent:
  branch_coverage_percent:
  build_gate_status: passing | failing
```

### Coverage Trends

- Coverage increasing/decreasing?
    
- Core services below 80%?
    

---

# 8. Documentation Integrity

Checklist Summary:

-  All PRDs updated
    
-  All Three Amigos sessions recorded
    
-  All technical reviews documented
    
-  All domains have required sections
    
-  All new features have release notes
    
-  All rulesets updated where required
    

Missing Artifacts:

---

# 9. Architectural Drift Analysis

Indicators:

- ☐ Event duplication
    
- ☐ Circular dependencies
    
- ☐ Cross-domain imports
    
- ☐ Layout misuse
    
- ☐ Unregistered hub
    
- ☐ Orphaned entities
    
- ☐ Unlinked events
    

Drift Severity:

- Low
    
- Medium
    
- High
    

---

# 10. Risk Register (Current Snapshot)

|Risk|Severity|Impact|Owner|Mitigation|
|---|---|---|---|---|

---

# 11. Improvement Plan

## Immediate Actions (0–30 days)

## Mid-Term Actions (30–90 days)

## Structural Improvements

---

# 12. Trend Tracking

## Compared to Previous Snapshot

- ASI delta:
    
- DMI delta:
    
- FRI delta:
    
- Violation delta:
    
- Coverage delta:
    

Trend Direction:

- Improving
    
- Stable
    
- Degrading
    

---

# 13. Governance Certification

This snapshot confirms that:

- Architecture remains aligned with standards
    
- Validation rules are enforced
    
- Documentation reflects implementation
    
- Governance discipline is active
    

Approved By:

- Architecture:
    
- Product:
    
- Engineering:
    
- QA:
    

Date:

---

# 14. Snapshot YAML Summary (Machine-Readable)

```yaml
governance_snapshot:
  version: 1.0
  scope:
  scope_id:
  created_at:

  asi:
    score:
    level:

  domain_maturity_avg:
  lowest_domain:
  highest_domain:

  fri_ready_features:
  fri_blocked_features:

  tasm_avg:
  lowest_tasm_scope:

  violations:
    advisory:
    warning:
    strict:

  coverage_percent:
  pass_rate_percent:

  drift_detected: false

  overall_health: critical | unstable | stable | strong | excellent

  top_risks:
    -
  improvement_actions:
    -
```

---

# 15. Strategic Purpose

The Governance Snapshot ensures:

- Governance is not anecdotal
    
- Architecture is measurable
    
- Documentation is enforced
    
- Quality is observable
    
- Drift is detected early
    
- Improvements are intentional
    

It operationalizes Flowti as:

> A measurable, continuously improving Business Operating System.

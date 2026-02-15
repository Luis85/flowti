---
type: ArchitectureStabilityIndex
standard_id: architecture_stability_index
version: 1
status: active
owner:
review_cycle: quarterly
related:
tags:
  - architecture
  - quality
  - governance
---
# Architecture Stability Index (ASI)

## 1. Purpose

The Architecture Stability Index (ASI) measures how reliably Flowti maintains:

- architectural boundaries
- event-driven discipline
- test gates
- manifest correctness
- documentation integrity

ASI is designed to detect **drift** early and provide a repeatable improvement path.

---

## 2. Scope

ASI can be calculated for:

- Whole system (global ASI)
- A domain hub (domain ASI)
- A feature (feature ASI)
- A release (release ASI)

---

## 3. Inputs

ASI is computed from four measurable sources:

1) **Three Amigos Scoring** (TASM)  
2) **Test Health** (from build reports)  
3) **Validation & Governance Violations** (Domain Validation Rulesets)  
4) **Documentation Completeness** (required artifacts present)

All scores are normalized to **0–100**.

---

## 4. Components

### 4.1 Component A — Architecture & Event Discipline (AED)

Source: **Three Amigos scores**
- architectural_integrity (0–5)
- event_discipline (0–5)

Formula:

```

AED = ((architectural_integrity + event_discipline) / 10) * 100

```

---

### 4.2 Component B — Test Health (TH)

Source: build pipeline (Vitest reports + skipped tests + coverage)

Define:

- pass_rate = passing_tests / (passing_tests + failing_tests)
- skip_penalty = min(skipped_tests / total_tests, 0.20)   # cap at 20%
- coverage = statement_coverage_percent (0–100)

Normalize:

```

TH = (0.55 * pass_rate_100) + (0.25 * coverage) + (0.20 * (100 - skip_penalty_100))

```

Notes:
- failing tests crush ASI via pass_rate
- coverage matters but is not allowed to dominate
- skipped tests are penalized but capped

---

### 4.3 Component C — Governance Violations (GV)

Source: validation violations emitted/detected.

Define violation weights:

- advisory = 1
- warning = 3
- strict = 8

Compute weighted violation rate per scope:

```

weighted_violations = advisory_1 + warning_3 + strict*8  
GV = max(0, 100 - (weighted_violations * 2))

```

Notes:
- Each weighted point reduces GV by 2
- GV bottoms at 0
- You can tune multipliers later

---

### 4.4 Component D — Documentation Integrity (DI)

Measure whether required artifacts exist and are updated:

For a given scope (feature/domain), define required artifacts (examples):

- PRD present
- FRI metrics present
- Technical review present
- Three Amigos score present (post-implementation)
- Domain note has required sections (purpose/boundaries/entities/events)
- Release note present (if released)

Compute:

```

DI = (completed_requirements / total_requirements) * 100

```

---

## 5. Final ASI Formula

Weights emphasize architecture + test discipline.

```

ASI = (0.35 * AED) + (0.35 * TH) + (0.20 * GV) + (0.10 * DI)

````

Result: 0–100

---

## 6. ASI Levels

| ASI | Level | Meaning |
|-----|-------|---------|
| 0–39 | 🔴 Critical | Structural risk; stabilization required |
| 40–59 | 🟠 Unstable | Drift likely; address top issues |
| 60–74 | 🟡 Stable | OK but needs investment |
| 75–89 | 🟢 Strong | Healthy and improving |
| 90–100 | 🟣 Excellent | Highly stable; governance is working |

---

## 7. ASI YAML Record Template

Embed in Governance snapshots or release notes.

```yaml
architecture_stability_index:
  version: 1.0
  scope: global | domain | feature | release
  scope_id:
  evaluated_at:
  evaluator:

  components:
    aed: 0   # 0-100
    th: 0    # 0-100
    gv: 0    # 0-100
    di: 0    # 0-100

  asi: 0     # 0-100
  level: critical | unstable | stable | strong | excellent

  top_risks:
    - 
  improvement_actions:
    - 
````

---

## 8. Interpretation Rules

- If **AED < 60** → architecture drift warning (run technical review + refactor)
    
- If **TH < 60** → test health is failing (stabilize pipeline)
    
- If **GV < 70** → ruleset enforcement too weak or behavior deviating
    
- If **DI < 70** → documentation debt accumulating (requires documentation sprint)
    

---

## 9. Governance Policy (Recommended)

- ASI must not decrease for 3 consecutive review cycles
    
- Any feature merged with ASI impact must include:
    
    - updated docs
        
    - updated manifests
        
    - tests for orchestration logic
        

---

# ✅ Architecture Quality Checklist

Use this checklist to **keep ASI stable or improve it**.  
Run it:

- before Technical Review
- before release
- after Three Amigos
- when ASI drops

```md
---
type: Checklist
checklist_id: architecture_quality
version: 1.0
owner:
tags:
  - quality
  - architecture
  - governance
---
# Architecture Quality Checklist

## A) Boundaries (Layout / UI / Domain)

- [ ] No domain logic inside layouts
- [ ] UI components do not mutate domain state directly
- [ ] All domain actions go through adapters/services
- [ ] No cross-service imports (coupling via events only)
- [ ] No duplication of Event Catalog logic

## B) Manifests & Configuration Discipline

- [ ] Tab definitions validate against schema
- [ ] Layout manifest is updated if regions/components changed
- [ ] Component manifest updated for new components
- [ ] No hard-coded region names outside layout library
- [ ] Default components exist for declared regions

## C) Event Discipline

- [ ] Produced events are documented and canonical
- [ ] Consumed events are explicit and scoped
- [ ] No circular event emissions detected
- [ ] No polling when event-driven refresh is possible
- [ ] Event payload contains required metadata (hub_id, entity_id, user_id where applicable)

## D) Test Health (aligns with TestPlan)

- [ ] Unit tests for pure functions / service logic added
- [ ] Integration/flow tests updated for changed behavior
- [ ] Failing tests = zero (build gate)
- [ ] Skipped tests justified and tracked
- [ ] Coverage is not decreasing for core services

## E) Performance & Scalability

- [ ] Tables virtualized when needed
- [ ] Graph views filtered/scoped
- [ ] No full vault scans triggered on render
- [ ] Caching/indexing strategy defined for aggregated views
- [ ] Event-driven refresh does not cause render storms

## F) Documentation Integrity

- [ ] PRD updated to reflect final behavior
- [ ] FRI metrics updated (if pre-implementation)
- [ ] Three Amigos score recorded (post-implementation)
- [ ] Technical Review recorded
- [ ] Domain docs updated (if impacted)
- [ ] Release note updated (if released)
- [ ] ✅ Documentation updated after session (mandatory)

## G) Decision Logging

- [ ] Key architectural decisions logged
- [ ] Tradeoffs documented
- [ ] Tech debt items created for intentional shortcuts

## Final Gate

- [ ] ASI components reviewed (AED/TH/GV/DI)
- [ ] Top 3 risks identified
- [ ] Improvement actions created and assigned
````

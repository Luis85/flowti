---
type: ReviewSessionTemplate
session_type: ThreeAmigos
frequency: # biweekly | monthly | sprint_end
owner:
participants:
  - product:
  - engineering:
  - ux_or_qa:
date:
related_hubs:
related_features:
scores_product_value: 0
scores_architectural_integrity: 0
scores_event_discipline: 0
scores_data_model_integrity: 0
scores_ux_quality: 0
scores_performance_scalability: 0
scores_documentation_discipline: 0
scores_total: 0
scores_max_score: 35
scores_health_level: # critical | unstable | stable | strong | excellent

drift_detected: false
refactor_required: false
immediate_action_required: false

summary: ""
---

# 🤝 Three Amigos Review Session

## 1️⃣ Purpose

This session exists to:

- Review product quality
- Detect architectural drift
- Identify UX friction
- Uncover deviations from standards
- Surface improvement opportunities
- Protect Flowti’s structural integrity

---

# 2️⃣ Session Scope

### Hubs Reviewed
- [ ] User Hub
- [ ] Product Hub
- [ ] Services Hub
- [ ] Areas Hub
- [ ] Project Hub
- [ ] Event Catalog
- [ ] Data Exchange

### Features Reviewed
- 
- 
- 

---

# 3️⃣ Product Perspective (Value & Clarity)

### 3.1 Value Delivery

- Is the feature solving the intended problem?
- Does it create measurable improvement?
- Are users actually using it?

Findings:

```

```

### 3.2 Scope Integrity

- Any scope creep?
- Any unclear boundaries?
- Any overlap with other features?

Findings:

```

```

---

# 4️⃣ Engineering Perspective (Architecture & Integrity)

### 4.1 Layout & UI Discipline

- Layout from library used?
- Region contracts respected?
- Any layout duplication?
- Any inline UI logic leaking domain logic?

Findings:

```

```

---

### 4.2 Adapter & Domain Discipline

- Domain logic isolated in HubAdapter?
- Any bypass of Event Catalog?
- Any direct state mutations?
- Any duplicated logic across hubs?

Findings:

```

```

---

### 4.3 Event Architecture

- Events canonical?
- Any circular emissions?
- EventBus refresh policy appropriate?
- Any polling that should be event-driven?

Findings:

```

```

---

### 4.4 Performance & Scalability

- Tables virtualized?
- Graph views scoped?
- No unbounded queries?
- Any performance regression?

Findings:

```

```

---

# 5️⃣ UX / QA Perspective (Clarity & Usability)

### 5.1 Workflow Clarity

- Does the flow make sense?
- Are actions discoverable?
- Are quick actions consistent?
- Any friction in cross-hub transitions?

Findings:

```

```

---

### 5.2 Documentation Experience

- Is documentation encouraged?
- Are sessions easy to start?
- Is coverage visible?
- Are missing documentation signals clear?

Findings:

```

```

---

# 6️⃣ Feature Readiness Review

For each feature reviewed:

| Feature | FRI Score | Current Maturity | Needs Update? |
|----------|-----------|-----------------|---------------|
|          |           |                 |               |

---

# 7️⃣ Architectural Drift Detection

Ask explicitly:

- Has any layout been duplicated?
- Has any component bypassed the registry?
- Has any adapter grown too large?
- Has any hub started owning logic it shouldn’t?
- Has any Event Catalog rule been violated?

Drift detected:

```

```

---

# 8️⃣ Improvement Backlog

Convert findings into:

- Events
- Features
- Refactor tasks
- Documentation improvements

| Improvement | Type | Hub | Priority |
|------------|------|------|----------|
|            |      |      |          |

---

# 9️⃣ Decisions Taken

Document explicit decisions:

```

```

---

# 🔟 Action Items

| Action | Owner | Due Date |
|--------|-------|----------|
|        |       |          |

---

# ✅ Final Checklist (Mandatory)

Before closing this session:

- [ ] All improvement items captured as Events or Tasks
- [ ] Any required PRD updates identified
- [ ] Any required Tab Definitions updated
- [ ] Layout Manifest updated (if needed)
- [ ] Component Manifest updated (if needed)
- [ ] Feature Readiness Index re-scored (if applicable)
- [ ] Architectural drift documented
- [ ] Decision log updated
- [ ] **Documentation updated to reflect changes discussed**

---

# 🧾 Session Summary

High-level conclusion:

```

```

Overall health assessment:

- 🟢 Healthy
- 🟡 Needs Refinement
- 🔴 Structural Risk

---

# 🤝 Three Amigos Scoring Model (TASM)

## Purpose

The Three Amigos Scoring Model (TASM) quantifies:

- Product quality
    
- Architectural integrity
    
- UX coherence
    
- Documentation discipline
    
- System health
    

It transforms qualitative discussion into structured signals.

---

# 1️⃣ Scoring Dimensions

Each dimension is scored from **0–5**.

|Score|Meaning|
|---|---|
|0|Critical issue / broken|
|1|Severe deviation|
|2|Significant weaknesses|
|3|Acceptable but improvable|
|4|Strong / well-implemented|
|5|Excellent / exemplary|

---

# 2️⃣ Dimensions

## A) Product Value & Clarity

Measures whether the feature/hub delivers meaningful value.

Evaluate:

- Solves intended problem
    
- Clear scope
    
- No duplication
    
- Adoption visible
    
- Improves workflow
    

Score: `0–5`

---

## B) Architectural Integrity

Measures compliance with Flowti structural rules.

Evaluate:

- Layout from library used
    
- No layout duplication
    
- No domain logic in UI
    
- Adapter boundaries respected
    
- Manifest compliance
    

Score: `0–5`

---

## C) Event Discipline

Measures event-driven purity.

Evaluate:

- Canonical event naming
    
- No duplicate event logic
    
- No bypass of Event Catalog
    
- Proper EventBus subscriptions
    
- No circular emissions
    

Score: `0–5`

---

## D) Data Model & Knowledge Graph Integrity

Measures structural consistency.

Evaluate:

- Entity consistency
    
- Relationship clarity
    
- No redundant fields
    
- Markdown generation consistent
    
- Knowledge graph reflects reality
    

Score: `0–5`

---

## E) UX & Flow Quality

Measures usability.

Evaluate:

- Discoverability
    
- Cross-hub transitions
    
- Workflow clarity
    
- Friction level
    
- Cognitive load
    

Score: `0–5`

---

## F) Performance & Scalability

Measures technical sustainability.

Evaluate:

- Virtualized lists
    
- Scoped graph rendering
    
- Event-driven refresh
    
- No unbounded queries
    
- Acceptable responsiveness
    

Score: `0–5`

---

## G) Documentation Discipline

Measures knowledge integrity.

Evaluate:

- Sessions used
    
- Documentation coverage visible
    
- PRDs updated
    
- Session artifacts persisted
    
- Drift captured
    

Score: `0–5`

---

# 3️⃣ Total Score Calculation

```
TASM = Sum(A–G)
Maximum = 35
```

---

# 4️⃣ Health Levels

|Score|Health|
|---|---|
|0–10|🔴 Critical|
|11–18|🟠 Unstable|
|19–25|🟡 Stable but needs refinement|
|26–30|🟢 Strong|
|31–35|🟣 Excellent|

---

# 5️⃣ Scoring YAML Template

Embed at end of session:

```yaml
three_amigos_score:
  version: 1.0
  evaluated_feature_or_hub:
  date:
  reviewers:
    - product:
    - engineering:
    - ux_or_qa:

  scores:
    product_value: 0
    architectural_integrity: 0
    event_discipline: 0
    data_model_integrity: 0
    ux_quality: 0
    performance_scalability: 0
    documentation_discipline: 0

  total_score: 0
  max_score: 35
  health_level: critical | unstable | stable | strong | excellent

  drift_detected: false
  refactor_required: false
  immediate_action_required: false

  summary: ""
```

---

# 6️⃣ Drift Escalation Rules

Automatic flags:

|Condition|Action|
|---|---|
|Architectural Integrity ≤ 2|Immediate refactor required|
|Event Discipline ≤ 2|Event audit required|
|Documentation Discipline ≤ 2|Mandatory session next sprint|
|Total Score ≤ 18|Feature enters “Stabilization Phase”|
|3 consecutive drops|Architecture review triggered|

---

# 7️⃣ Trend Tracking

You should track:

- TASM score per hub per month
    
- TASM score per feature at release
    
- Average system health
    

Optional future metric:

```
Architecture Stability Index = avg(architectural_integrity + event_discipline)
```

---

# 8️⃣ Relationship to Feature Readiness Index

|Feature Readiness Index|Three Amigos Scoring|
|---|---|
|Pre-implementation maturity|Post-implementation quality|
|Gate before coding|Health after release|
|Structural discipline|Operational discipline|

Together they form:

```
FRI → Build Right
TASM → Stay Right
```

---

# 9️⃣ Example (Domain Hubs)

Hypothetical score:

```yaml
scores:
  product_value: 5
  architectural_integrity: 5
  event_discipline: 4
  data_model_integrity: 4
  ux_quality: 4
  performance_scalability: 4
  documentation_discipline: 3
```

Total = 29 → 🟢 Strong

Action: Improve documentation coverage signals.

---

# 🔟 Why This Model Is Powerful

It:

- Prevents silent architecture drift
    
- Makes quality visible
    
- Quantifies technical debt
    
- Encourages documentation discipline
    
- Aligns product + engineering + UX
    
- Reinforces event-driven purity
    

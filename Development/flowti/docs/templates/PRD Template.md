---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: FeatureTemplate
stage: draft
related_hubs:
related_events:
maturity: L0
maturity_score_strategy:
maturity_score_scope:
maturity_score_architecture:
maturity_score_event_integration:
maturity_score_data_model:
maturity_score_ui_consistency:
maturity_score_validation_testing:
business_value:
implementation_cost:
maintenance_cost:
discovery_cost:
design_cost:
test_cost:
priority:
---

# Feature: <Feature Name>

## 1. Problem Statement

What concrete problem does this feature solve?

- Who is affected?
- What currently breaks or causes friction?
- Why does this matter strategically?

---

## 2. Outcome (Success Definition)

What changes after implementation?

- User can ...
- System can ...
- Domain gains ...

Define measurable success if possible.

---

## 3. Scope

### In Scope
- Explicit behaviors
- Required integrations
- Affected hubs

### Out of Scope
- What we deliberately exclude in v1

---

## 4. UX Entry Points

Where does this feature live?

- User Hub
- Domain Hub
- System Hub
- New Hub?

Primary interaction path:
1.
2.
3.

---

## 5. Functional Requirements

List atomic, testable behaviors.

Example format:

- [ ] User can create …
- [ ] System generates …
- [ ] Dashboard updates when …
- [ ] Event emitted …

---

## 6. Data Model Impact

New entities?
New fields?
New relationships?

```

entity_name  
field  
relation

```

---

## 7. Event Impact

Which events are:

- Produced?
- Consumed?
- Transformed?

List canonical event names.

---

## 8. UI Layout Impact

Layout used:
- dashboard_grid
- table
- split_dock
- board
- graph
- session_focus

Tabs affected:
- tab_id:
  - layout:
  - new regions? (yes/no)

---

## 9. Adapter Impact

Which HubAdapter(s) change?

- ProductHubAdapter
- UserHubAdapter
- SystemHubAdapter
- New adapter?

New methods:
- get…
- create…
- compute…

---

## 10. Non-Functional Requirements

Performance?
Virtualization?
Event-driven refresh?
Caching?
Access control?

---

## 11. Risks

| Risk | Mitigation |
|------|------------|

---

## 12. Acceptance Criteria

Clear, binary outcomes.

- [ ] …
- [ ] …
- [ ] …

---

## 13. Definition of Done

- Schema updated
- Layout manifest updated (if needed)
- Component manifest updated (if needed)
- Validator passes
- Unit tests added
- Documentation updated

---

# 📊 Flowti Feature Readiness Index (FRI)

The **Feature Readiness Index (FRI)** measures how structurally, technically, and operationally mature a feature is.

It ensures that features are:

- Strategically aligned
    
- Architecturally compliant
    
- UI-consistent
    
- Event-integrated
    
- Testable
    
- Documented
    
- Production-ready
    

---

# 1️⃣ Maturity Levels

|Level|Name|Meaning|
|---|---|---|
|L0|Idea|Concept exists only as thought|
|L1|Defined|PRD written and scoped|
|L2|Architected|Layout + Adapter + Events defined|
|L3|Implemented|Code exists + validation passes|
|L4|Integrated|Works across hubs + Event Catalog|
|L5|Operational|Stable, measured, documented|

---

# 2️⃣ Feature Readiness Dimensions

Each feature is scored across 7 dimensions.

Each dimension is scored 0–5.

|Dimension|Description|
|---|---|
|Strategy|Alignment with Flowti vision|
|Scope|Clarity and boundedness|
|Architecture|Layout + Adapter + Manifest compliance|
|Event Integration|Event production/consumption defined|
|Data Model|Entities + relationships defined|
|UI Consistency|Layout + region contract adherence|
|Validation & Testing|Validator passes + unit tests|

Maximum score = 35 points

---

# 3️⃣ Readiness Score Interpretation

|Score|Status|
|---|---|
|0–10|Not Ready|
|11–18|Conceptual|
|19–25|Technically Ready|
|26–30|Integration Ready|
|31–35|Production Ready|

---

# 4️⃣ Feature Maturity Checklist

This checklist determines the score.

---

## A) Strategy (0–5)

|Check|Yes|
|---|---|
|Clear problem statement exists||
|Outcome defined||
|Linked to Hub(s)||
|Linked to Event Catalog||
|Aligned with IBDE vision||

Scoring:

- 0 = no strategy
    
- 3 = partially defined
    
- 5 = fully articulated and aligned
    

---

## B) Scope (0–5)

|Check|Yes|
|---|---|
|In/Out of scope defined||
|Acceptance criteria atomic||
|Edge cases considered||
|No overlap with other feature||
|Versioning defined (v1 vs future)||

---

## C) Architecture (0–5)

|Check|Yes|
|---|---|
|Layout selected from Layout Library||
|Tab definition created||
|Adapter methods defined||
|Layout manifest compliant||
|Component manifest compliant||

---

## D) Event Integration (0–5)

|Check|Yes|
|---|---|
|Events produced defined||
|Events consumed defined||
|Event names canonical||
|EventBus refresh policies defined||
|No event duplication logic||

---

## E) Data Model (0–5)

|Check|Yes|
|---|---|
|Entities defined||
|Fields defined||
|Relationships defined||
|Markdown generation specified||
|Knowledge graph impact defined||

---

## F) UI Consistency (0–5)

|Check|Yes|
|---|---|
|Layout regions valid||
|Required regions satisfied||
|Virtualized tables used where needed||
|Graph view scoped properly||
|No layout duplication||

---

## G) Validation & Testing (0–5)

|Check|Yes|
|---|---|
|Tab schema validation passes||
|Layout manifest validation passes||
|Component manifest validation passes||
|Unit tests written||
|Integration tested across hubs||

---

# 5️⃣ Readiness Formula

Simple:

```
FRI = Sum(all dimension scores)
```

Optional weighted formula (if needed later):

```
FRI = (Strategy*1.2 + Architecture*1.2 + EventIntegration*1.2 + others*1.0)
```

But keep v1 simple.

---

# 6️⃣ Example: Domain Hubs Feature

Approximate current state:

|Dimension|Score|
|---|---|
|Strategy|5|
|Scope|4|
|Architecture|5|
|Event Integration|4|
|Data Model|4|
|UI Consistency|5|
|Validation|4|

Total ≈ **31/35 → Production Ready (Architecturally)**

This is excellent for a draft feature.

---

# 7️⃣ Maturity Checklist (Operational Gate)

Before moving feature from `draft → approved`, all must be true:

### Mandatory Gates

-  PRD One-Pager complete
    
-  Tab Definition created
    
-  Layout manifest unchanged OR updated intentionally
    
-  Component manifest updated (if needed)
    
-  Validation passes
    
-  Adapter methods stubbed
    
-  Event impact reviewed
    
-  No architectural rule violation
    

Before moving from `approved → implemented`:

-  Unit tests pass
    
-  EventBus wiring tested
    
-  Performance acceptable
    
-  No duplicate logic in hub vs event catalog
    

Before moving from `implemented → operational`:

-  Documentation added
    
-  Example usage added
    
-  User Hub reflects change if relevant
    
-  Metrics/telemetry enabled
    
-  Feature reviewed after 1 iteration
    

---

# 8️⃣ Optional: Automation Idea

You can automate FRI scoring via:

- JSON metadata in PRD frontmatter
    
- CLI script that:
    
    - checks for tab definition file
        
    - validates against layout + component manifest
        
    - checks adapter existence
        
    - counts tests
        
    - outputs FRI score
        

Example frontmatter (individual dimensions only — totals computed by Base formulas):

```yaml
maturity_score_strategy: 5
maturity_score_scope: 4
maturity_score_architecture: 5
maturity_score_event_integration: 4
maturity_score_data_model: 4
maturity_score_ui_consistency: 5
maturity_score_validation_testing: 4
```

---

# 9️⃣ Why This Matters

This index prevents:

- “Looks done” features that break architecture
    
- UI inconsistency
    
- Event duplication
    
- Manifest drift
    
- Adapter chaos
    
- Feature entropy
    

It enforces:

> Structural integrity before velocity.


---

# 📋 Feature Prioritization Scoring

The **Feature Prioritization Score** complements FRI by measuring **business impact and cost** to help decide **what to build next**.

Where FRI answers "Is this feature ready to build?", prioritization answers "Should we build this feature now?"

---

## Dimensions

Each dimension is scored **0–5** (or `null` if not yet assessed).

| Dimension | Description | Scale |
|---|---|---|
| **business_value** | Strategic importance to the product vision and end users | 0 = none, 5 = critical |
| **implementation_cost** | Effort to build the feature (code, integration, architecture) | 0 = trivial, 5 = massive |
| **maintenance_cost** | Ongoing effort to maintain (bug surface, complexity, dependencies) | 0 = self-sustaining, 5 = constant upkeep |
| **discovery_cost** | Effort to research, explore, and understand the problem space | 0 = well understood, 5 = uncharted territory |
| **design_cost** | Effort for UX/UI design, interaction patterns, and information architecture | 0 = standard patterns, 5 = novel design |
| **test_cost** | Effort to test (unit, integration, flow, manual verification) | 0 = trivial to test, 5 = exhaustive testing required |
| **priority** | Overall priority considering all dimensions | 0 = backlog, 5 = build immediately |

---

## Scoring Guidelines

### business_value
- **5**: Core to the product vision; blocks other features; high user demand
- **4**: Important capability; significant user value; enables new workflows
- **3**: Useful improvement; moderate user impact
- **2**: Nice to have; quality-of-life improvement
- **1**: Marginal benefit; edge case coverage
- **0**: No clear business case

### Cost Dimensions (implementation, maintenance, discovery, design, test)
- **5**: Requires major architectural changes, new domains, extensive research, or novel patterns
- **4**: Significant effort; multi-service integration; weeks of work
- **3**: Moderate effort; touches multiple files/modules; days of work
- **2**: Straightforward; well-understood patterns; hours of focused work
- **1**: Small change; single module; quick implementation
- **0**: Trivial; nearly zero effort

### priority
- **5**: Build immediately — blocks critical path or has exceptional value-to-cost ratio
- **4**: Build next — high value, manageable cost, strategically important
- **3**: Build soon — good value, moderate cost, part of the roadmap
- **2**: Build eventually — useful but not urgent; can wait for the right moment
- **1**: Consider — low priority; may become relevant later
- **0**: Parked — no current plan to build

---

## Prioritization Formula (Advisory)

A simple value-weighted priority can be derived:

```
Priority Signal = business_value - ((discovery_cost + design_cost + implementation_cost + test_cost + maintenance_cost) / 5).round()
```

This averages all 5 cost dimensions into a single cost score (0–5), then subtracts from business_value.

- **Result range**: -5 to +5
- **Positive**: value exceeds average cost → prioritize
- **Negative**: average cost exceeds value → deprioritize
- **Zero**: value and cost are balanced

This formula is advisory — the `priority` field captures the human judgment that accounts for dependencies, strategic timing, and sequencing.

---

## Frontmatter Fields

```yaml
business_value: 0-5
implementation_cost: 0-5
maintenance_cost: 0-5
discovery_cost: 0-5
design_cost: 0-5
test_cost: 0-5
priority: 0-5
```

All fields are optional. `null` (empty) means "not yet assessed."

---

# 🛠 Flowti Technical Review Checklist

**Purpose:**
Ensure architectural integrity, manifest compliance, and event-driven consistency before implementation.

**Applies to:**  
All new features and significant changes.

---

# 1️⃣ Review Metadata

```yaml
feature_name:
reviewer:
review_date:
stage: draft | pre-implementation | pre-release
result: pass | conditional_pass | fail
follow_up_required: true | false
```

---

# 2️⃣ Strategic & Scope Validation

### 2.1 Problem Clarity

-  Clear problem statement exists
    
-  Outcome is measurable
    
-  Feature belongs to a specific Hub or System layer
    
-  No duplication with existing feature
    

### 2.2 Scope Control

-  In-scope and out-of-scope defined
    
-  v1 boundaries respected
    
-  No hidden cross-domain side effects
    

---

# 3️⃣ Architectural Integrity

### 3.1 Layout Compliance

-  Layout selected from Layout Library
    
-  No new layout introduced without architectural discussion
    
-  Tab Definition created
    
-  Region overrides valid against Layout Manifest
    
-  Required regions satisfied
    

### 3.2 Component Compliance

-  All components exist in Component Manifest
    
-  No inline ad-hoc components bypassing registry
    
-  No layout-specific logic inside components
    
-  Component responsibilities clearly bounded
    

### 3.3 Adapter Discipline

-  Feature logic resides in HubAdapter (not UI)
    
-  No domain logic in layouts
    
-  No Event Catalog duplication
    
-  Adapter methods are minimal and focused
    

---

# 4️⃣ Event Architecture Review

### 4.1 Event Production

-  Produced events are defined
    
-  Event names follow canonical naming
    
-  Events contain required metadata (hub_id, entity_id, user_id)
    

### 4.2 Event Consumption

-  EventBus subscriptions defined
    
-  No polling where event-driven refresh is possible
    
-  No circular event emission
    

### 4.3 Event Catalog Integrity

-  Feature does not bypass Event Catalog
    
-  Events remain source of truth
    
-  No local state divergence from catalog
    

---

# 5️⃣ Data Model Review

-  New entities defined clearly
    
-  Field naming consistent (lowercase_snake_case)
    
-  Relationships explicitly defined
    
-  Markdown generation defined (if applicable)
    
-  Knowledge graph impact reviewed
    
-  No redundant fields introduced
    

---

# 6️⃣ Performance & Scalability

-  Tables use virtualization when large
    
-  Graph views scoped or filtered
    
-  No unbounded data loads
    
-  Caching strategy defined (if needed)
    
-  Refresh policy is event-driven
    

---

# 7️⃣ Manifest & Validation Review

-  Tab config validates against Tab Schema
    
-  Tab config validates against Layout Manifest
    
-  Tab config validates against Component Manifest
    
-  No orphan layout regions
    
-  Default components exist
    
-  No schema violations
    

---

# 8️⃣ Cross-Hub Impact

-  Feature does not break User Hub aggregation
    
-  Feature integrates cleanly with Event Catalog
    
-  Feature integrates cleanly with Projects folder
    
-  No unexpected side effects in System Hubs
    

---

# 9️⃣ Risk & Complexity Assessment

-  Feature complexity justified
    
-  No architectural shortcuts
    
-  No temporary hacks introduced
    
-  Migration plan defined (if refactoring)
    

---

# 🔟 Decision Section

### Review Outcome

|Result|Meaning|
|---|---|
|✅ Pass|Ready for implementation|
|⚠ Conditional Pass|Minor fixes required|
|❌ Fail|Architectural issues must be resolved|

---

### Required Follow-Ups

```
- ...
- ...
- ...
```

---

# 🧭 5-Minute Reviewer Heuristic

If time is short, ask:

1. Does this feature violate layout or adapter boundaries?
    
2. Does it bypass the Event Catalog?
    
3. Does it introduce new UI patterns instead of using the library?
    
4. Does it introduce domain logic in UI?
    
5. Would this scale to 1000 entities?
    

If any answer feels uncertain → deeper review required.

---

# 🔒 Non-Negotiables (Architectural Constitution Alignment)

Automatic failure if:

- Domain logic inside layout
    
- Hard-coded region names outside manifest
    
- Direct store mutation bypassing adapters
    
- Duplicate event handling logic
    
- New layout without manifest update
    

---

# 🚀 Why This Checklist Matters

It protects:

- Structural consistency
    
- Event-driven integrity
    
- Manifest discipline
    
- Layout reuse
    
- Adapter purity
    
- Long-term scalability
    

Without it, entropy wins.

---


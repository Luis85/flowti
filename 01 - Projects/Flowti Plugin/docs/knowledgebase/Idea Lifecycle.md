# **Idea → Feature Backlog Flow**

---

# 1. Purpose

This process defines how raw ideas are transformed into validated Feature Backlog items using a structured ingestion workflow based on Markdown notes.

It ensures:

- No premature backlog pollution
    
- Context-first thinking
    
- Structured maturation
    
- Three Amigos validation
    
- Clear lifecycle traceability
    
- ISO 9001 compatible requirement qualification
    

---

# 2. Scope

This process applies to:

- Product ideas
    
- Improvements
    
- Feature suggestions
    
- Architectural enhancements
    
- UX refinements
    
- Technical enablers
    

---

# 3. Conceptual Model

The system distinguishes between:

|Stage|Artifact|Meaning|
|---|---|---|
|1|Pure Idea Note|Unstructured input|
|2|Enriched Idea|Contextualized and typed|
|3|Qualified Idea|Reviewed and backlog-ready|
|4|Backlog Item|Official Feature/PBI|
|5|PRD Lifecycle|Standard development|

---

# 4. Storage Structure

```
/00 - Connectivity/inbox/
   idea-title.md
```

Inbox is:

- Low-friction capture mechanism

- Permanent anchor — notes never leave this folder

- Starting point for all work sessions

- Not part of backlog

- Not yet committed work

> **Key principle:** Inbox notes are never moved, deleted, or locked. They remain as permanent anchors for traceability. All subsequent work — sessions, backlog items, PRDs, increments — traces back to the original idea note in the inbox.
    

---

# 5. Idea Note Structure

## 5.1 Initial State – Pure Idea

File name = Title

Example:

```
Session based workspace for focused collaboration.md
```

Frontmatter:

```yaml
type:
stage:
origin:
domain:
parent:
description:
tags:
priority:
rank:
```

### Priority Model

Priority is assigned during or immediately after capture. It drives focus order in the inbox Dataview.

|Value|Meaning|
|---|---|
|`2 - high`|Immediate value or blocking dependency — ingest first|
|`01 - medium`|Clear potential but not urgent — ingest when capacity allows|
|`0 - low`|Exploratory or long-term — park until context emerges|

### Rank Model

Rank provides granular ordering within the same priority tier. It is optional — unranked ideas (`null`) sort after ranked ones.

|Value|Meaning|
|---|---|
|`null`|Not yet ranked — no relative ordering within tier|
|`0`|Highest rank (do first within tier)|
|`1–4`|Intermediate ranks|
|`5`|Lowest rank (do last within tier)|

The inbox Dataview (`00 - Inbox.base`) sorts by `priority` descending, then `rank` ascending (nulls last), then `file.mtime` newest-first. This gives a natural focus order: high-priority, top-ranked, recent ideas surface first.

If `stage` is empty →
→ The idea is **pure and waiting for ingestion**

---

# 6. Process Flow

---

## Step 1 — Capture

**Trigger:**  
User has an idea.

**Action:**

- Create Markdown file in `/00 - Connectivity/inbox`
    
- File name becomes title
    
- No friction
    
- No formatting required
    

Status:

```
type: (empty)
stage: (empty)
origin: (empty)
domain: (empty)
tags: (empty)
priority: (assigned at capture — 0-low, 01-medium, 2-high)
rank: (optional — 0-5 for granular ordering within tier)
...remaining fields empty
```

---

## Step 2 — Ingestion & Massaging

Actor: Product Owner (or responsible domain owner)

Goal: Transform raw thought into structured idea.

**Session:** Start a documentation session from the inbox note. The idea note is added as a context binding (focus file) to the session — this creates the traceability link between idea and work effort. All ingestion work happens within this session.

Actions:

- Start session from inbox note (context binding)

- Clarify problem statement

- Add context

- Add affected domain

- Add potential business value

- Identify stakeholders

- Identify impacted artifacts

- Add first JTBD
    

Frontmatter updated:

```yaml
type: idea
stage: discovery
domain: flowti
maturity: L0
```

Now the idea becomes:

> Enriched Idea

---

## Step 3 — Typing

The idea must be assigned a type.

Possible Types:

- feature
    
- improvement
    
- technical_enabler
    
- ux_enhancement
    
- refactoring
    
- experiment
    

The template enforced depends on the type.

Example:

```yaml
type: Feature
stage: refinement
```

Each type requires:

|Type|Required Sections|
|---|---|
|feature|Problem, JTBD, Scope, Acceptance Criteria|
|improvement|Current State, Desired State|
|technical_enabler|Technical Context, Constraints|
|ux_enhancement|User Impact, Flow Changes|

An idea cannot move forward unless all required sections are filled.

---

## Step 4 — Qualification (Three Amigos Review)

Actors:

- Product Owner
    
- Architect
    
- Engineer (or UX if UX-driven)
    

Goal:

- Validate clarity
    
- Validate feasibility
    
- Validate value
    
- Validate scope
    
- Confirm readiness
    

If accepted:

```yaml
stage: qualified
reviewed_by:
  - po
  - architect
  - engineer
reviewed_at: 2026-02-18
```

At this point:

> The Idea Note becomes Backlog Ready.

---

## Step 5 — Backlog Item Creation

Trigger:  
Idea stage = qualified

Action:

- Create official Backlog Item (Feature / PBI)
    
- Reference original idea note
    
- Copy structured data
    
- Link both directions
    

Backlog item frontmatter:

```yaml
type: Feature
origin: inbox
origin_ref: Inbox/session-workspace.md
derived_from: idea
```

Event emitted:

```
backlog.item.generated
```

---

## Step 6 — PRD Lifecycle

Now the item enters your standard lifecycle:

```
New → Scoping → Discovery → Refinement → Ready → Development → Testing → Review → Done → Closed
```

From this point onward, the backlog item drives development.

The inbox note remains as the permanent traceability anchor. All work — sessions, increments, PRDs — can be traced back to the original idea in the inbox.

---

# 7. Stage Model of Idea Notes

|Stage|Meaning|
|---|---|
|(empty)|Pure idea|
|discovery|Context building|
|refinement|Structured and typed|
|qualified|Backlog ready|
|rejected|Explicitly declined|
|parked|Delayed|

---

# 8. Maturity Model

|Level|Description|
|---|---|
|L0|Raw thought|
|L1|Context enriched|
|L2|Typed and structured|
|L3|Reviewed|
|L4|Backlog ready|

---

# 9. Governance Rules

1. Inbox is NOT the backlog.

2. Nothing enters backlog without typing.

3. Nothing enters backlog without Three Amigos review.

4. Ideas can be rejected.

5. Rejected ideas are kept for traceability.

6. All backlog items must reference origin.

7. No development starts from unqualified idea notes.

8. All work sessions start from an inbox note.

9. Inbox notes are permanent — never moved, deleted, or locked.
    

---

# 10. Benefits

### Prevents

- Backlog clutter
    
- Vague requirements
    
- Emotional prioritization
    
- Technical debt injection
    

### Enables

- Controlled ingestion
    
- Clear accountability
    
- ISO 9001 traceability
    
- Living documentation
    
- Knowledge graph linkage
    

---

# 11. Event Model

Events emitted during process:

- idea.created
    
- idea.enriched
    
- idea.typed
    
- idea.review.requested
    
- idea.qualified
    
- idea.rejected
    
- backlog.item.generated
    

---

# 12. Visual Lifecycle

```
Inbox (Pure) ← note stays here permanently
   ↓
Session Started (idea bound as context)
   ↓
Discovery (enriched within session)
   ↓
Refinement (Typed)
   ↓
Three Amigos Review
   ↓
Qualified
   ↓
Backlog Item Created (references idea)
   ↓
PRD Lifecycle (traceable back to idea)
```

---
# **UC-IDEA-01 – Qualify Idea and Promote to Backlog**

---

## 1. Scope

**System:** Flowti – Integrated Business Development Environment  
**Level:** User Goal  
**Primary Actor:** Product Owner  
**Supporting Actors:** Architect, Engineer (Three Amigos)  
**Stakeholders:** Product Team, Delivery Manager, QA

---

## 2. Brief Description

This use case describes the structured transformation of a raw idea captured in the Inbox into a qualified backlog item ready to enter the PRD development lifecycle.

The process ensures that no unqualified ideas enter the backlog and that traceability is preserved.

---

## 3. Preconditions

- An idea note exists in `/00 - Connectivity/inbox/`
    
- The idea may have `frontmatter`
    

---

## 4. Postconditions

### Success Guarantee

- Idea note is typed
    
- Required template fields are completed
    
- Three Amigos review completed
    
- `stage: qualified`
    
- Backlog item created
    
- Traceability link established
    
- Event `backlog.item.generated` emitted
    

### Minimal Guarantee

- Idea remains in Inbox with updated stage
    
- No partial backlog item created
    

---

## 5. Main Success Scenario

---

### 1. Capture Idea

1. User creates a Markdown file in `/00 - Connectivity/inbox/`
    
2. File name becomes the title
    
3. `stage` is empty
    

---

### 2. Enrich Idea

4. Product Owner reviews the idea
    
5. Problem statement is clarified
    
6. Context and domain are added
    
7. Initial JTBD are documented
    
8. `stage` is set to `discovery`
    

---

### 3. Type the Idea

9. Product Owner assigns a type  
    (Feature, Improvement, etc.)
    
10. System loads type-specific template requirements
    
11. Required sections are completed
    
12. `stage` is set to `refinement`
    

---

### 4. Validate Completeness

13. System validates required sections
    
14. If mandatory fields are missing → cannot proceed
    

---

### 5. Three Amigos Review

15. Review session is conducted
    
16. PO validates business value
    
17. Architect validates feasibility
    
18. Engineer validates implementation clarity
    
19. Required adjustments are made
    
20. Idea is approved
    

---

### 6. Qualification

21. `stage` is set to `qualified`
    
22. `reviewed_by` metadata updated
    
23. `reviewed_at` timestamp added
    

---

### 7. Backlog Promotion

24. Product Owner triggers "Create Backlog Item"
    
25. System creates new Feature/PBI
    
26. Backlog item references original idea
    
27. Original idea references backlog item
    
28. Event `backlog.item.generated` emitted
    

---

### 8. Completion

29. Idea note gains `promoted_to` link — remains in inbox as permanent anchor

30. Backlog item enters PRD lifecycle
    

---

## 6. Alternative Flows

---

### A1 – Idea Rejected

At Step 15:

- Review determines insufficient value or misalignment
    
- `stage: rejected`
    
- Rationale documented
    
- No backlog item created
    

---

### A2 – Idea Parked

At Step 15:

- Idea valid but not timely
    
- `stage: parked`
    
- Review notes added
    
- Review scheduled later
    

---

### A3 – Template Incomplete

At Step 13:

- System detects missing required sections
    
- Promotion blocked
    
- Idea remains in `refinement`
    

---

## 7. Special Requirements

### Governance

- No backlog creation without `stage: qualified`
    
- All backlog items must reference origin
    
- All qualified ideas must contain review metadata
    

### Traceability

Each backlog item must contain:

```yaml
origin: inbox
origin_ref: path/to/idea.md
derived_from: idea
```

Each idea must contain:

```yaml
promoted_to: backlog/feature-id.md
sessions:
  - session-title (date)
```

> The idea note remains in the inbox permanently. Sessions reference the idea via context bindings; the idea references sessions for reverse traceability.

---

## 8. Frequency of Occurrence

High – Continuous process

---

## 9. Business Rules

BR-01: Inbox is not backlog
BR-02: Typing is mandatory
BR-03: Lightweight Three Amigos review mandatory
BR-04: No partial backlog item creation
BR-05: Rejected ideas remain documented
BR-06: Stage must always reflect maturity
BR-07: All work sessions originate from an inbox note
BR-08: Inbox notes are permanent anchors — never moved or deleted

---

## 10. State Model (Idea Artifact)

```
(empty)
   ↓
discovery (session started)
   ↓
refinement
   ↓
qualified
   ↓
promoted (note remains in inbox as anchor)
```

With branches:

```
refinement → rejected
refinement → parked
```

---

## 11. Event Model

|Event|Trigger|
|---|---|
|idea.created|Inbox file created|
|idea.enriched|Stage → discovery|
|idea.typed|Type assigned|
|idea.review.requested|Review initiated|
|idea.qualified|Approved|
|idea.rejected|Declined|
|backlog.item.generated|Promotion|

---

## 12. Data Model (Conceptual)

### Idea Note

```yaml
type: Idea
stage: discovery | refinement | qualified | rejected | parked
domain:
maturity: L0–L4
priority: 0 - low | 01 - medium | 2 - high
rank: null | 0–5
reviewed_by:
reviewed_at:
promoted_to:
sessions:
```

> `sessions` tracks all work sessions that referenced this idea as a context binding, providing full traceability from idea to work effort.

---

## 13. Traceability Matrix

|Artifact|Linked To|
|---|---|
|Idea|Session, Backlog Item|
|Session|Idea (via context binding)|
|Backlog Item|Idea (via `origin_ref`)|
|Review Notes|Idea|
|PRD|Backlog Item|
|Increment|PRD, Backlog Item|

> **Traceability chain:** Idea → Session → Backlog Item → PRD → Increment → Delivered Feature. Every link in this chain can be traced back to the original inbox note.

---

## 14. Success Metrics

- % of ideas reaching qualified
    
- Average time in discovery
    
- Average time in refinement
    
- Rejection rate
    
- Idea → Backlog conversion rate
    
- Idea aging metric
    

---

Next: 

- [[Development Lifecycle]]
- [[Increment Lifecycle]]
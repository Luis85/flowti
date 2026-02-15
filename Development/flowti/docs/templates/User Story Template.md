---
type: UserStoryTemplate
domain: Flowti
stage: draft
owner:
created_at:
last_reviewed_at:
tags:
  - template
  - user-story
  - documentation
---

# User Story Template

> A structured shape for documenting user stories. User stories are the primary feedback artifact in the Development Lifecycle — they carry requirements from persona needs through to testable acceptance criteria.

---

# How to Use This Template

1. Replace `{{Story Title}}` with a concise description of the story
2. Fill frontmatter fields — every user story must have `type: UserStory`, `persona`, `feature`, and `stage`
3. Section 1 (Narrative) is mandatory — the "As a / I want / So that" framing is non-negotiable
4. Section 2 (Acceptance Criteria) is mandatory — a story without criteria cannot be verified
5. Section 3 (Context) and beyond add depth for development and review
6. Stories should be small enough to implement in a single iteration

---

# User Story Frontmatter Schema

Every user story file must use this frontmatter shape:

```yaml
---
type: UserStory
persona: # [[Persona Name]] — who is the actor
feature: # [[Feature Name]] — which feature this story belongs to
domain: # primary domain
stage: # idea | draft | ready | development | done
plugin: "[[Development/flowti/README|README]]"
description: # one-line summary
priority: # critical | high | medium | low
effort: # small | medium | large
related_jtbd: # [[JTBD]] — which job this story fulfills
related_flow: # [[Flow]] — which flow this story participates in
tags:
  - user-story
---
```

---

## 1. Narrative

**Purpose:** Express the story in the canonical "As a / I want / So that" format. This is the irreducible core — everything else serves this.

### 1.1 Story

**As a** [[{{Persona Name}}]],
**I want to** <!-- action the user wants to take -->,
**so that** <!-- value or outcome the user gains -->.

### 1.2 Context

<!-- Why does this story matter now? What triggered the need? What happens if we don't build it? -->

### 1.3 Business Value

<!-- What value does this deliver? Revenue, efficiency, risk reduction, user satisfaction? -->

| Value Dimension | Impact |
|----------------|--------|
| | high / medium / low |

---

## 2. Acceptance Criteria

**Purpose:** Define binary pass/fail conditions that determine when the story is done. Every criterion must be testable — if you cannot write a test for it, rewrite it.

### 2.1 Criteria

Write criteria in Given/When/Then format:

```gherkin
Given [precondition]
When [action]
Then [expected outcome]
```

| # | Criterion | Testable |
|---|-----------|----------|
| AC-1 | | yes / no |
| AC-2 | | |
| AC-3 | | |

### 2.2 Edge Cases

<!-- What boundary conditions, error states, or unusual inputs should be handled? -->

| Edge Case | Expected Behavior |
|-----------|-------------------|
| | |
| | |

### 2.3 Out of Scope

<!-- What does this story explicitly NOT cover? Reference other stories if they handle adjacent behavior. -->

-
-

---

## 3. Dependencies & Constraints

**Purpose:** Identify what must exist before this story can be implemented and what limits the solution space.

### 3.1 Prerequisites

<!-- What must be true before development can begin? Other stories, infrastructure, data, decisions? -->

- [ ]
- [ ]

### 3.2 Technical Constraints

<!-- What technical realities limit the solution? Performance targets, API contracts, compatibility? -->

-
-

### 3.3 Domain Constraints

<!-- What domain rules or business logic constrain the implementation? -->

-
-

---

## 4. Impact

**Purpose:** Trace this story's impact on the system. Every story touches data, events, and UI — making this explicit prevents surprises during implementation.

### 4.1 Data Impact

| Entity | Change | Fields Affected |
|--------|--------|----------------|
| | created / updated / read / deleted | |
| | | |

### 4.2 Event Impact

| Event | Role | Description |
|-------|------|-------------|
| | produced / consumed | |
| | | |

### 4.3 UI Impact

| Component | Change | Description |
|-----------|--------|-------------|
| | new / modified / removed | |
| | | |

---

## 5. INVEST Checklist

**Purpose:** Verify this story meets quality standards before it enters development. A story that fails INVEST criteria should be reworked.

| Criterion | Met | Notes |
|-----------|-----|-------|
| **I**ndependent — Can be implemented without depending on other stories | yes / no | |
| **N**egotiable — Details can be discussed; not a contract | yes / no | |
| **V**aluable — Delivers value to the user or business | yes / no | |
| **E**stimable — Team can estimate the effort | yes / no | |
| **S**mall — Can be completed in a single iteration | yes / no | |
| **T**estable — Acceptance criteria can be verified | yes / no | |

---

## 6. Related Artifacts

**Purpose:** Connect this story to the rest of the documentation system.

| Artifact Type | Link | Relationship |
|--------------|------|-------------|
| Persona | [[]] | actor |
| Feature | [[]] | parent |
| Job to Be Done | [[]] | demand |
| Flow | [[]] | journey |
| Component | [[]] | UI surface |

---

## 7. Review Log

| Date | Reviewer | Changes | Trigger |
|------|----------|---------|---------|
| | | Initial creation | |

---

# Conceptual Summary

A user story is a promise of a conversation. It exists to:
- **Carry requirements** — from persona needs through to testable acceptance criteria
- **Enable estimation** — small, independent, estimable units of work
- **Support verification** — every story has pass/fail criteria that can be tested
- **Connect demand to supply** — stories link personas and JTBDs to features and flows

The minimum viable user story has a Narrative (1) and Acceptance Criteria (2). Everything else adds context for development, review, and traceability.

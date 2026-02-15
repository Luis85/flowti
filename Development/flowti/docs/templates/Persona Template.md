---
type: PersonaTemplate
domain: Flowti
stage: draft
owner:
created_at:
last_reviewed_at:
tags:
  - template
  - persona
  - documentation
---

# Persona Template

> A structured shape for documenting user personas. Personas ground all design and prioritization decisions in real user context — who they are, what drives them, and where they struggle.

---

# How to Use This Template

1. Replace `{{Persona Name}}` with the actual persona name
2. Fill frontmatter fields — every persona must have `type: Persona`, `domain`, and `stage`
3. Start with sections 1–3 (Identity, Goals, Pain Points) — these are the minimum viable persona
4. Sections 4–6 add operational context for deeper design work
5. Section 7 (Related Artifacts) connects this persona to the rest of the living documentation
6. Review and update personas when Jobs to Be Done or features shift

---

# Persona Frontmatter Schema

Every persona file must use this frontmatter shape:

```yaml
---
type: Persona
domain: # primary domain this persona interacts with
stage: # draft | done
plugin: "[[Development/flowti/README|README]]"
description: # one-line summary of who this persona is
related_domains: # list of domains this persona touches
related_features: # list of features this persona uses
tags:
  - persona
---
```

---

## 1. Identity

**Purpose:** Establish who this persona is at a glance. This section answers "who am I reading about?"

### 1.1 Name & Role

- **Persona Name:** {{Persona Name}}
- **Role:** <!-- e.g., Plugin Developer, Domain Architect, Product Owner -->
- **Archetype:** <!-- one phrase that captures the essence: "The Builder", "The Organizer" -->

### 1.2 Quote

> *"A representative quote that captures this persona's mindset and motivation."*

### 1.3 Profile Summary

<!-- 2–3 sentences describing this persona: who they are, what context they work in, what drives their day-to-day. -->

---

## 2. Goals & Motivations

**Purpose:** What this persona is trying to achieve. Goals drive feature prioritization — a feature that serves no persona goal has no user.

### 2.1 Primary Goals

<!-- What does this persona need to accomplish? List 3–5 goals ordered by importance. -->

| # | Goal | Frequency | Criticality |
|---|------|-----------|-------------|
| 1 | | daily / weekly / monthly | high / medium / low |
| 2 | | | |
| 3 | | | |

### 2.2 Success Criteria

<!-- How does this persona know they succeeded? What does "done" look like from their perspective? -->

-
-
-

---

## 3. Pain Points & Frustrations

**Purpose:** Where the current experience fails this persona. Pain points generate requirements — every pain point is an opportunity for a feature or improvement.

### 3.1 Current Pain Points

| Pain Point | Severity | Workaround | Related Feature |
|-----------|----------|------------|-----------------|
| | high / medium / low | | [[Feature]] |
| | | | |

### 3.2 What Would Make Them Leave

<!-- What failure modes are unacceptable to this persona? Where is the breaking point? -->

-
-

---

## 4. Context & Environment

**Purpose:** The operational context this persona works in. Context shapes what solutions are viable — a solution that ignores context will be rejected.

### 4.1 Tools & Technologies

<!-- What tools does this persona already use? What is their technical comfort level? -->

| Tool / Technology | Proficiency | Usage |
|-------------------|------------|-------|
| | expert / intermediate / beginner | |
| | | |

### 4.2 Workflow Context

<!-- When and how does this persona interact with the system? -->

- **Typical session duration:** <!-- e.g., 5 min check-in, 30 min deep work, 2 hr planning -->
- **Frequency of use:** <!-- daily / weekly / ad-hoc -->
- **Environment:** <!-- solo, collaborative, review meeting -->
- **Trigger:** <!-- what event causes them to open the system -->

### 4.3 Constraints

<!-- What limits this persona? Time, skill, access, organizational rules? -->

-
-

---

## 5. Behavioral Patterns

**Purpose:** How this persona actually behaves (not how we wish they behaved). Behavioral patterns inform UX decisions and flow design.

### 5.1 Decision Style

<!-- How does this persona make decisions? Data-driven, intuition, consensus, authority? -->

### 5.2 Information Seeking

<!-- How do they find answers? Search, browse, ask, read docs? What do they try first? -->

### 5.3 Error Recovery

<!-- What do they do when something goes wrong? Retry, investigate, escalate, abandon? -->

---

## 6. Domain Interaction Map

**Purpose:** Show which domains this persona touches and in what capacity. This connects personas to the domain model.

### 6.1 Domain Touchpoints

| Domain | Interaction | Frequency | Typical Flow |
|--------|-------------|-----------|-------------|
| | creates / reads / configures / reviews | | [[Flow Name]] |
| | | | |

### 6.2 Cross-Domain Journeys

<!-- Which user journeys involve this persona crossing domain boundaries? -->

-
-

---

## 7. Related Artifacts

**Purpose:** Connect this persona to the rest of the documentation system. A persona without links is isolated from the living organism.

### 7.1 Jobs to Be Done

| Job | Priority | Status |
|-----|----------|--------|
| [[JTBD Name]] | | |
| | | |

### 7.2 User Stories

| Story | Feature | Status |
|-------|---------|--------|
| [[User Story]] | [[Feature]] | |
| | | |

### 7.3 Features Used

| Feature | Importance | Satisfaction |
|---------|------------|-------------|
| [[Feature]] | critical / important / nice-to-have | high / medium / low |
| | | |

---

## 8. Review Log

| Date | Reviewer | Changes | Trigger |
|------|----------|---------|---------|
| | | Initial creation | |

---

# Conceptual Summary

A persona is a documented archetype of a real user. It exists to:
- **Ground decisions** — every feature, flow, and priority should trace back to a persona need
- **Prevent projection** — we build for documented users, not imagined ones
- **Enable empathy** — reading a persona should make the user's world tangible

The minimum viable persona covers Identity (1), Goals (2), and Pain Points (3). Everything else adds depth for design and prioritization work.

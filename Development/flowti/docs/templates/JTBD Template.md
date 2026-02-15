---
type: JTBDTemplate
domain: Flowti
stage: draft
owner:
created_at:
last_reviewed_at:
tags:
  - template
  - jtbd
  - documentation
---

# Job to Be Done Template

> A structured shape for documenting Jobs to Be Done. JTBDs capture what users need to accomplish independent of any specific solution — they are the stable demand that features supply.

---

# How to Use This Template

1. Replace `{{Job Statement}}` with the actual job in "I need to..." format
2. Fill frontmatter fields — every JTBD must have `type: Job to be Done`, `persona`, and `stage`
3. Start with sections 1–3 (Job Statement, Context, Success Criteria) — these are the minimum viable JTBD
4. Section 4 (Current Alternatives) reveals what the solution must beat
5. Section 5 (Feature Links) connects the job to its solutions
6. Section 6 (Prioritization) helps rank jobs against each other
7. A JTBD without a linked persona is ungrounded — always verify the persona exists

---

# JTBD Frontmatter Schema

Every JTBD file must use this frontmatter shape:

```yaml
---
type: Job to be Done
persona: # [[Persona Name]] — who has this job
domain: # primary domain that serves this job
stage: # idea | draft | validated | done
plugin: "[[Development/flowti/README|README]]"
description: # one-line summary of the job
related_features: # list of features that address this job
related_flows: # list of flows that fulfill this job
priority: # critical | high | medium | low
tags:
  - jtbd
---
```

---

## 1. Job Statement

**Purpose:** Define the job in the user's own language. The job is the demand — it exists whether or not we build anything.

### 1.1 Core Job

**When** <!-- situation/trigger -->,
**I need to** {{Job Statement}},
**so that** <!-- desired outcome -->.

### 1.2 Job Context

<!-- In what circumstances does this job arise? What makes it urgent or important? -->

### 1.3 Job Category

- **Type:** <!-- functional | emotional | social -->
- **Frequency:** <!-- daily | weekly | monthly | ad-hoc | one-time -->
- **Criticality:** <!-- blocking | important | nice-to-have -->

---

## 2. Scope

**Purpose:** Bound the job. What is included and what is explicitly outside this job's responsibility.

### 2.1 In Scope

<!-- What activities, decisions, and outcomes belong to this job? -->

-
-
-

### 2.2 Out of Scope

<!-- What related activities are NOT part of this job? Reference other JTBDs if they cover adjacent work. -->

-
-

---

## 3. Success Criteria

**Purpose:** How the persona knows the job is done. Success criteria are solution-independent — they describe the outcome, not the mechanism.

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | | yes / no |
| 2 | | |
| 3 | | |

---

## 4. Current Alternatives

**Purpose:** What the persona does today to get this job done. Current alternatives reveal the baseline a solution must beat and the switching costs involved.

### 4.1 Existing Solutions

| Alternative | Strengths | Weaknesses |
|------------|-----------|------------|
| | | |
| | | |

### 4.2 Workarounds

<!-- Are there manual processes, spreadsheets, verbal agreements, or other hacks currently in use? -->

-
-

### 4.3 What Would "Hiring" a New Solution Require

<!-- What switching costs exist? What does the persona need to give up or learn? -->

---

## 5. Form

**Purpose:** How the job materializes in the system. This section bridges the abstract job to concrete features and flows.

### 5.1 Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Feature Name]] | primary / supporting | full / partial |
| | | |

### 5.2 Flow Links

| Flow | Role | Stage |
|------|------|-------|
| [[Flow Name]] | primary / supporting | |
| | | |

### 5.3 Event Links

<!-- Which domain events are produced or consumed when this job is performed? -->

| Event | Domain | Role |
|-------|--------|------|
| | | trigger / step / completion |
| | | |

---

## 6. Prioritization

**Purpose:** Rank this job relative to other jobs. Not all jobs are equal — prioritization prevents spreading effort across too many jobs at once.

### 6.1 Importance vs. Satisfaction

| Dimension | Score (1–5) | Notes |
|-----------|-------------|-------|
| Importance | | How important is getting this job done? |
| Satisfaction | | How well is it done today? |
| Opportunity | | `= Importance + max(Importance - Satisfaction, 0)` |

> **Opportunity Score** formula (Ulwick): Jobs with high importance and low satisfaction have the highest opportunity.

### 6.2 Persona Priority

<!-- How does the persona rank this job relative to their other jobs? Is it top-of-mind or background? -->

---

## 7. Open Questions

<!-- What is still unknown about this job? What assumptions need validation? -->

- [ ]
- [ ]

---

## 8. Review Log

| Date | Reviewer | Changes | Trigger |
|------|----------|---------|---------|
| | | Initial creation | |

---

# Conceptual Summary

A Job to Be Done is a stable unit of user demand. It exists to:
- **Separate demand from supply** — the job persists even as features change
- **Focus on outcomes** — what the user needs to achieve, not what buttons to click
- **Enable prioritization** — jobs with high importance and low satisfaction are the highest-value opportunities
- **Connect to features** — every feature should trace back to at least one JTBD; features without jobs are solutions in search of problems

The minimum viable JTBD covers the Job Statement (1), Scope (2), and Success Criteria (3). The Form section (5) connects it to the rest of the living documentation.

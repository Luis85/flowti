---
type: ProductBacklogItemTemplate
feature: "[[Feature PRD]]"
stage: planned  # planned | in-progress | done | deferred
priority: medium  # critical | high | medium | low
phase: 0  # delivery phase number from parent PRD roadmap
effort: medium  # small (<1 day) | medium (1-3 days) | large (3+ days)
dependencies: []  # wikilinks to other PBIs, TDs, or ADRs that must be resolved first
user_story: ""  # wikilink to the originating user story or inbox item
note: ""  # short status note visible in backlog views (e.g., "3 of 5 increments done")
tags:
  - backlog
---

# PBI-XXX: Title

> Replace `XXX` with the next sequential number for this feature's backlog (e.g., PBI-001, PBI-002).
> File naming convention: `PBI-XXX Title.md` in the feature's `backlog/` folder.

---

## User Story — Problem Space

State the problem from the user's perspective. Use one or more "As a…, I want…, so that…" statements. Each statement should map to a single capability the user gains.

```
As a [persona], I want [capability] so that [outcome/value].
```

**Example:**
> As a domain architect, I want time-boxed documentation sessions with a Pomodoro timer so that I can maintain documentation discipline through structured workflows.

Multiple user stories are acceptable when the PBI serves more than one persona or addresses connected needs. Group related stories together.

### User Pains

What problems does the user experience today? Be specific — reference actual workflows, missing capabilities, or friction points observed during usage.

- Pain 1: Description of what's broken, missing, or frustrating
- Pain 2: …

### User Needs

What does the user need to resolve the pains above? These are requirements stated from the user's perspective (not technical solutions).

- Need 1: What the user needs to be able to do
- Need 2: …

---

## Solution Statement

### Use Cases

Describe how the user interacts with the solution. Provide both a narrative flow and a Gherkin scenario for the primary use case.

**Flow:**
User opens [entry point] → performs [action] → system responds with [behavior] → user sees [outcome]

**Gherkin:**
```gherkin
Given [precondition]
When [user action]
Then [expected outcome]
And [additional verification]
```

### Functional Requirements

Checkbox list of what must be built. Each requirement should be independently verifiable. Mark with `[x]` when delivered, and add an italic note referencing the increment.

- [ ] Requirement 1 — description
- [ ] Requirement 2 — description

### Technical Requirements

Implementation constraints and architectural decisions that guide how the functional requirements are built. These are not user-visible but affect delivery.

- Service implements `IService` with `load()` + `dispose()` lifecycle
- Data persisted via TypedStorage under key `"key_name"`
- Events registered in catalog with appropriate category and tags
- …

### Constraints

Hard boundaries that limit the solution. Include performance budgets, backward compatibility requirements, and scope exclusions.

- Constraint 1
- Constraint 2

---

## Acceptance Criteria

Checkbox list of verifiable conditions that must ALL be true for the PBI to be considered done. Each criterion should be testable — either by automated test or manual verification.

- [ ] Criterion 1 — *Increment N*
- [ ] Criterion 2 — *Increment N*
- [ ] `npm run build` passes with all tests green

### INVEST Checklist

Before marking the PBI as ready for implementation, verify:

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent — can be delivered without other PBIs in flight | | |
| **N**egotiable — scope can be adjusted without losing core value | | |
| **V**aluable — delivers user-facing or architectural value | | |
| **E**stimable — effort and scope are understood | | |
| **S**mall — deliverable in 1-3 increments | | |
| **T**estable — acceptance criteria are verifiable | | |

---

## Implementation Progress

Track delivery across increments. Each increment gets a subsection with file lists. This section grows as increments are delivered.

### Increment 1: Title (YYYY-MM-DD)

New files:
- `path/to/file.ts` — description

Modified files:
- `path/to/file.ts` — what changed

### Increment 2: Title (YYYY-MM-DD)

…

---

## Related

- PRD: `[[Feature PRD]]`
- User Story: `[[User Story]]`
- ADRs: `[[ADR-NNN Title]]`
- Increment Docs: `[[Phase N Inc M - Title]]`
- Tech Debt: `[[TD-NN Title]]`

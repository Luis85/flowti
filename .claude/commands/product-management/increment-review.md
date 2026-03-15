---
name: increment-review
description: Run an increment review ceremony — demo completed work, verify scope items, gather stakeholder feedback
user-invocable: true
---

# Increment Review

Guide an increment review (sprint review / demo) ceremony. Summarizes completed work, walks through each scope item for acceptance, and captures stakeholder feedback.

**Iteration status context:** During `in-review` phase.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation). Ask the user which project if ambiguous.
2. Read the current iteration plan from `<project>/iterations/iteration-*-plan.md` — find the iteration with status `in-review` (or the one specified by user)
3. Parse scope items: count `- [x]` (done) vs `- [ ]` (open) for completion %
4. Read deliverables from `<project>/docs/deliverables/*.md` linked to this iteration
5. Pull git log for the iteration period:
   ```
   git log --oneline --after=<startDate> --before=<endDate>
   ```
6. Run `flowti reports --project="<project-name>"` from the git root to generate fresh metrics
7. Run `flowti health --project="<project-name>" --format=json` for quality gate status

### Step 2: Present Increment Summary (automated)

**Scope Completion:**
```
| # | Scope Item | Status | Notes |
|---|------------|--------|-------|
| 1 | Define Agent entity model | done | - |
| 2 | Agent CRUD operations | done | - |
| 3 | Agent brief generation | open | blocked by #4 |
```
Completion: X/Y items (Z%)

**Quality Metrics:**
- Tests: N passing, M failing
- Coverage: X% statements, Y% lines
- Lint: clean / N issues
- Build: passing / failing

**Commit Activity:**
- N commits during iteration period
- M files changed

**Quality Gates:**
- [List pass/fail status from health report]

### Step 3: Demo Walkthrough (human-driven)

For each **completed** scope item (status `done`), one at a time:

1. Present the scope item description and its acceptance criteria
2. Ask: **"Does this meet the acceptance criteria?"**
3. The user marks each as:
   - **Accepted** — scope item confirmed as done
   - **Accepted with notes** — done but has follow-up work. Ask: "What follow-up is needed?" Capture as a new backlog item
   - **Rejected** — does not meet criteria. Ask: "What's missing or wrong?" Capture the reason and move the item back to the backlog

For **open** scope items:
- Present each and ask: **"Should this carry over to the next iteration, or be dropped?"**
- Carry-over items will be included in the next iteration's backlog

### Step 4: Stakeholder Feedback Capture (human-driven)

Ask: **"Any feedback, new ideas, or concerns from this review?"**

For each piece of feedback:
1. Capture it as a new item
2. Ask: Is this a **requirement**, **deliverable**, or **RAID item**?
3. Write the appropriate markdown file in the matching `docs/` directory
4. Tag with `source: increment-review` and `iteration: N` in frontmatter

### Step 5: Produce Review Record (automated)

1. Write the review summary to `<project>/iterations/iteration-NNN-review.md`:

```markdown
---
type: IncrementReview
iteration: N
date: YYYY-MM-DD
scopeCompleted: X
scopeTotal: Y
completionRate: Z%
---

# Increment Review — Iteration #N

## Summary

- Scope items completed: X/Y (Z%)
- Items accepted: A
- Items accepted with notes: B
- Items rejected: C
- Items carried over: D

## Scope Item Results

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | ... | accepted | - |
| 2 | ... | rejected | Missing edge case handling |

## Quality Metrics

[paste metrics from Step 2]

## Stakeholder Feedback

- [captured feedback items with links to created files]

## Follow-Up Items

- [list of new items created from notes/rejections/feedback]
```

2. Update scope items in the iteration plan if any were rejected (change `[x]` back to `[ ]` if re-scoped)
3. Commit all artifacts:
   ```
   git add "01 - Projects/Flowti CLI/iterations/iteration-NNN-review.md" [+ any new requirement/deliverable/raid files]
   git commit -m "chore(iteration-N): increment-review — X/Y accepted, C rejected, D carried over"
   ```

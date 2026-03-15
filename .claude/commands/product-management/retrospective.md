---
name: retrospective
description: Run a retrospective ceremony — reflect on what went well and poorly, generate action items and CAPAs, capture velocity
user-invocable: true
---

# Retrospective

Guide a retrospective ceremony. Presents iteration data (velocity, scope changes, quality metrics, agent utilization), facilitates structured reflection, and produces action items including CAPA entries for process issues.

**Iteration status context:** After iteration reaches `done`.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation). Ask the user which project if ambiguous.
2. Read the iteration plan from `<project>/iterations/iteration-*-plan.md` — find the iteration with status `done` or `in-review` (the most recently completed, or the one specified by user)
3. Run `flowti reports --project="<project-name>"` from the git root to generate fresh reports (note: `iteration-retrospective` generator must be registered in `flowti.config.json`)
4. Read the increment review record from `<project>/iterations/iteration-NNN-review.md` (if exists)
5. Compute velocity:
   - Scope items committed: use `scopeTotal` from the review record frontmatter (this captures the count at review time, before any post-review changes). If no review record exists, fall back to counting `- [ ]` + `- [x]` in the current plan.
   - Scope items completed: `scopeCompleted` from review record, or `- [x]` count from plan
   - Completion rate: `completed / committed * 100`
6. Read CAPA items from `<project>/docs/capa/*.md` — any created during this iteration
7. Read agent briefs from `<project>/iterations/briefs/iteration-NNN-*` — check `status` field (open/active/done)

### Step 2: Present Retrospective Data (automated)

**Velocity:**
- Committed: N items | Delivered: M items | Rate: X%
- Compared to previous iteration: +/- Y% (or "first iteration — no comparison")

**Scope Changes:**
- Items added mid-iteration: N
- Items removed mid-iteration: M
- Net scope change: +/- K items

**Quality Metrics:**
- Test coverage: X% → Y% (delta)
- Lint issues: N
- Build status: passing/failing
- Gate pass/fail record during iteration

**Agent Utilization:**
```
| Agent | Phase(s) | Brief Status | Tasks Completed |
|-------|----------|-------------|-----------------|
| Product Owner | new | done | 5 |
| Software Architect | planned | done | 8 |
```

**Timeline:**
- Planned: startDate → endDate (N days)
- Actual: [did it finish on time?]

### Step 3: Reflection Prompts (human-driven)

Ask each prompt one at a time, waiting for the user's response before proceeding:

1. **"What went well this iteration that we should keep doing?"**
2. **"What didn't go well that we should stop or change?"**
3. **"What should we try next iteration that we haven't done before?"**
4. **"Were there any blockers or surprises? What caused them?"**
5. **"Rate this iteration 1-5. Why?"**

For each response, acknowledge and capture the insight. Do not rush through — these reflections are the most valuable part of the ceremony.

### Step 4: Action Items (hybrid)

Based on the user's reflections:

1. Suggest concrete action items. For each, present:
   - **What**: specific action to take
   - **Who**: suggested owner (agent from roster)
   - **When**: next iteration or specific date
   - **Type**: process improvement, tooling, team practice, etc.

2. Ask the user to **confirm, adjust, or reject** each suggested action item

3. For confirmed items, categorize:
   - **Process issues** → Create a CAPA item in `<project>/docs/capa/`:
     ```yaml
     ---
     type: CAPA
     title: [issue description]
     status: open
     severity: [minor/major/critical]
     source: retrospective
     iteration: N
     date: YYYY-MM-DD
     ---
     ```
   - **Improvement ideas** → Create a requirement or deliverable for the next iteration's backlog
   - **Config changes** → Suggest specific updates to `flowti.config.json` (thresholds, gates, orchestration)

### Step 5: Produce Retrospective Record (automated)

1. Write to `<project>/iterations/iteration-NNN-retrospective.md`:

```markdown
---
type: Retrospective
iteration: N
date: YYYY-MM-DD
rating: X/5
velocityRate: Y%
---

# Retrospective — Iteration #N

## Velocity

- Committed: N items | Delivered: M items | Rate: X%
- Previous iteration: Y% | Delta: +/- Z%

## What Went Well

[User's response]

## What Didn't Go Well

[User's response]

## What to Try Next

[User's response]

## Blockers & Surprises

[User's response]

## Rating: X/5

[User's reasoning]

## Action Items

| # | Action | Owner | When | Type | Status |
|---|--------|-------|------|------|--------|
| 1 | ... | Product Owner | Next iteration | process | open |

## CAPAs Created

- [links to any CAPA files created]

## Backlog Items Created

- [links to any requirement/deliverable files created]
```

2. Update iteration status to `done` in the plan file's frontmatter (if not already `done`)
3. Commit all artifacts:
   ```
   git add "01 - Projects/Flowti CLI/iterations/iteration-NNN-retrospective.md" [+ any CAPA/backlog files]
   git commit -m "chore(iteration-N): retrospective — rating X/5, Y action items, Z CAPAs"
   ```

---
name: iteration-planning
description: Run an iteration planning ceremony — commit to scope, assign agents, set capacity, produce the iteration plan
user-invocable: true
---

# Iteration Planning

Guide an iteration planning ceremony. Reviews refined backlog, team capacity, and previous velocity to help the product team commit to scope and produce a concrete iteration plan.

**Iteration status context:** `new → planned` transition.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/skills/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
2. Read the current iteration plan from `<project>/iterations/iteration-*-plan.md` — find the iteration with status `new` (or the one specified by user)
3. Read the most recent refinement session from `<project>/iterations/refinement-*.md` for prioritized backlog
4. Read the agent roster from `03 - Resources/Agents/*.md` (vault-root-relative, exclude `.prompt.md` files) — parse `preferredPhases`, `roles`, `skills`
4. Read previous iteration plans to compute velocity:
   - Find iterations with status `done`
   - Count scope items committed vs. completed
   - Calculate average completion rate
5. Read orchestration config from `<project>/configs/flowti.config.json` → `management.iterations.orchestration.phases`
6. Check iteration gates: does the current iteration have `goal`, `scope`, `dates`?

### Step 2: Present Planning Inputs (automated)

Present to the user:

**Iteration Goal:**
> [Current goal from plan frontmatter, or "(not set — needs a goal)"]

**Capacity Table:**
```
| Agent | Domain | Roles | Preferred Phases |
|-------|--------|-------|-----------------|
| Product Owner | product | Refiner, Planner | new, planned, in-review |
| Software Architect | engineering | Planner | planned |
| ... | ... | ... | ... |
```

**Velocity Reference** (from previous iterations):
- Previous iteration: N/M items completed (X%)
- Average: Y items/iteration at Z% completion rate
- (or "No previous iterations — no velocity baseline yet")

**Candidate Scope Items** (from refinement, ordered by priority):
```
| # | Item | Estimate | Priority | Source |
|---|------|----------|----------|--------|
| 1 | ... | S | must | refinement-2026-03-15 |
```

### Step 3: Scope Commitment (human-driven)

1. If no goal is set, ask: **"What is the goal for this iteration?"** (one sentence)
2. Present the top-N items that fit within the velocity baseline
3. Ask: **"Which items do you commit to for this iteration?"**
   - User can accept the suggested set, add items, remove items, or adjust
4. For each committed item, verify acceptance criteria exist. If missing, ask the user to provide them now
5. Confirm start and end dates (default: today + `management.iterations.durationDays` from config, typically 14 days)

### Step 4: Task Breakdown (hybrid)

For each committed scope item:

1. Suggest a breakdown into concrete tasks from the Software Architect perspective:
   - What files need to be created or modified?
   - What tests need to be written?
   - What dependencies exist between tasks?
2. Ask the user to **confirm or adjust** the task list
3. Assign agents to tasks based on:
   - `preferredPhases` from agent definitions
   - `orchestration.phases` from config (e.g., Product Owner for `new`, Software Architect for `planned`)
   - User overrides

### Step 5: Produce Iteration Plan (automated)

1. Create or update the iteration plan file at `<project>/iterations/iteration-NNN-plan.md`:
   - Set frontmatter: `status: planned`, `goal`, `startDate`, `endDate`, `agents`
   - Write `## Scope Items` with all committed items as `- [ ]` checkboxes
   - Add a transition history row: `| YYYY-MM-DD | new | planned | Scope committed in planning ceremony |`

2. Generate agent brief files in `<project>/iterations/briefs/`:
   - One brief per assigned agent per phase
   - Filename format: `iteration-NNN-{slugified-agent}--{slugified-phase}.md`
   - Frontmatter: `agent`, `iteration`, `phase`, `status: open`
   - Include: role context, iteration goal, assigned scope items, acceptance criteria

3. Commit all artifacts:
   ```
   git add "01 - Projects/Flowti CLI/iterations/iteration-NNN-plan.md" "01 - Projects/Flowti CLI/iterations/briefs/"
   git commit -m "chore(iteration-N): iteration-planning — committed N scope items, assigned M agents"
   ```

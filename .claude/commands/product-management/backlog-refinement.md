---
name: backlog-refinement
description: Run a backlog refinement ceremony — groom items, clarify scope, estimate, and prioritize for upcoming iterations
user-invocable: true
---

# Backlog Refinement

Guide a backlog refinement ceremony. Gathers candidate items from requirements, deliverables, and RAID, then walks through each item for clarification, estimation, and prioritization.

**Iteration status context:** Before/during `new` phase.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
2. Read current iteration plan(s) from `<project>/iterations/iteration-*-plan.md` — parse frontmatter and scope items
3. Read requirements from `<project>/docs/requirements/*.md` — identify items with status `draft` or `proposed` (ungroomed)
4. Read deliverables from `<project>/docs/deliverables/*.md` — identify items with status `blocked` or `planned`
5. Read RAID items from `<project>/docs/raid/*.md` — identify open risks and issues
6. Read the most recent refinement session (if exists) from `<project>/iterations/refinement-*.md`

### Step 2: Present Backlog Snapshot (automated)

Present a table of candidate items to the user:

```
| # | Item | Source | Status | Has AC? | Estimate | Priority |
|---|------|--------|--------|---------|----------|----------|
| 1 | ... | requirement | draft | No | - | - |
| 2 | ... | deliverable | planned | Yes | M | should |
| 3 | ... | RAID-issue | open | No | - | - |
```

Flag items that are missing:
- Acceptance criteria (no `## Acceptance Criteria` section or empty)
- Estimates (no `estimate` in frontmatter)
- Clear scope (description is vague or missing)

Highlight dependencies between items — check RAID items, deliverable predecessors, and cross-requirement links.

### Step 3: Refinement Loop (human-driven)

For each candidate item, one at a time:

1. Present the item's current description and any existing acceptance criteria
2. Ask: **"Is this item clear enough to estimate? What's missing?"**
3. Based on the response:
   - **If unclear**: Ask clarifying questions to fill gaps. Capture the answers and update the item's description/acceptance criteria
   - **If clear**: Ask for:
     - **Estimate** (T-shirt size): S (< 2h), M (2-4h), L (4-8h), XL (> 8h)
     - **MoSCoW priority**: must, should, could, wont
4. The user can also: **skip** (leave for next session), **split** (break into smaller items), **merge** (combine with another item), or **reject** (remove from backlog)

Continue until the user says they're done or all items have been processed.

### Step 4: Prioritized Backlog Output (automated)

1. Produce a ranked list of all refined items, ordered by priority (must > should > could) then estimate (S > M > L > XL)
2. Update the requirement/deliverable markdown files directly with any changes made during refinement (updated descriptions, acceptance criteria, estimates, priorities)
3. Write a refinement session summary to `<project>/iterations/refinement-YYYY-MM-DD.md`:

```markdown
---
type: RefinementSession
date: YYYY-MM-DD
itemsReviewed: N
itemsRefined: N
---

# Backlog Refinement — YYYY-MM-DD

## Summary

- Items reviewed: N
- Items refined: N
- Items split: N
- Items rejected: N

## Refined Items

| # | Item | Estimate | Priority | Status |
|---|------|----------|----------|--------|
| 1 | ... | M | must | refined |

## Decisions

- [record any key decisions made during the session]

## Carry-Over

- [items skipped or deferred to next session]
```

4. Commit all changes:
   ```
   git add "01 - Projects/Flowti CLI/iterations/refinement-YYYY-MM-DD.md" [+ any updated requirement/deliverable files]
   git commit -m "chore(iteration-N): backlog-refinement — refined N items"
   ```

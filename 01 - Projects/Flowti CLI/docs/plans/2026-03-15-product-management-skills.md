# Product Management Skills — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 6 user-invocable Claude Code skills and 1 shared foundation for product management ceremonies under `.claude/skills/product-management/`.

**Architecture:** Local project skills (markdown files with YAML frontmatter) that guide hybrid ceremonies — automating data gathering via Claude Code tools (Read, Glob, Grep) and pausing at decision points for human judgment. A shared `_foundation.md` documents common patterns referenced by all ceremony skills.

**Tech Stack:** Claude Code skills (markdown), `.flowti/config.json` (skillMap), `flowti.config.json` (management config)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-product-management-skills-design.md`

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `.flowti/config.json` | Append product-management skills to `skillMap.product` and `skillMap.management` |
| Modify | `01 - Projects/Flowti CLI/configs/flowti.config.json` | Add `management.features` + register `iteration-retrospective` generator |
| Create | `.claude/skills/product-management/_foundation.md` | Shared patterns for all ceremony skills (non-invocable) |
| Create | `.claude/skills/product-management/backlog-refinement.md` | Backlog refinement ceremony skill |
| Create | `.claude/skills/product-management/iteration-planning.md` | Iteration planning ceremony skill |
| Create | `.claude/skills/product-management/increment-review.md` | Increment review ceremony skill |
| Create | `.claude/skills/product-management/retrospective.md` | Retrospective ceremony skill |
| Create | `.claude/skills/product-management/three-amigos-review.md` | Three Amigos review skill |
| Create | `.claude/skills/product-management/feature-document.md` | Feature document curation skill |

---

## Chunk 1: Config Changes + Foundation

### Task 1: Update flowti.config.json — register generator + add features config

Two changes to the same file, committed together:
1. Register `iteration-retrospective` in `reports.generators[]` (the Retrospective skill depends on it)
2. Add `management.features` entry (the Feature Document skill depends on it)

Note: The `iteration-retrospective` generator is registered in code (`generator-registry.ts`) with `category: "reference"`. Verify after adding that `flowti reports` actually executes it.

**Files:**
- Modify: `01 - Projects/Flowti CLI/configs/flowti.config.json`

- [ ] **Step 1: Read the current config**

Read `01 - Projects/Flowti CLI/configs/flowti.config.json`. Locate:
- `reports.generators` array (currently 6 entries: `test`, `coverage`, `codebase`, `complexity`, `status`, `summary`)
- `management` section (currently has: `resources`, `timelog`, `deliverables`, `raid`, `requirements`, `capa`, `iterations`, `agents`)

- [ ] **Step 2: Add iteration-retrospective generator entry**

Add this entry to `reports.generators`, after `complexity` and before `status`:

```json
{
  "id": "iteration-retrospective",
  "label": "Iteration Retrospective"
}
```

- [ ] **Step 3: Add management.features entry**

Add to the `management` section, after `deliverables`:

```json
"features": {
  "dir": "docs/features"
},
```

- [ ] **Step 4: Verify valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('01 - Projects/Flowti CLI/configs/flowti.config.json', 'utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 5: Verify iteration-retrospective report executes**

Run from git root: `cd "01 - Projects/Flowti CLI" && node ../../.flowti/bin/main.js reports --project="Flowti CLI" 2>&1 | head -20`
Verify the output includes `Iteration Retrospective` (or similar). If it does not appear, check whether the pipeline filters by `category` and whether `"reference"` generators are excluded. If excluded, add `"category": "report"` to the config entry and re-verify.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/flowti.config.json"
git commit -m "chore: register iteration-retrospective generator and add management.features config"
```

---

### Task 2: Update skillMap in .flowti/config.json

**Files:**
- Modify: `.flowti/config.json`

- [ ] **Step 1: Read the current skillMap**

Read `.flowti/config.json` and locate the `agents.skillMap` object. The current entries for `product` and `management` are:

```json
"product": [
  "superpowers:brainstorming",
  "superpowers:writing-plans"
],
"management": [
  "superpowers:dispatching-parallel-agents",
  "superpowers:writing-plans",
  "superpowers:executing-plans"
]
```

- [ ] **Step 2: Append product-management skills to the product array**

Update the `product` array to:

```json
"product": [
  "superpowers:brainstorming",
  "superpowers:writing-plans",
  "product-management:backlog-refinement",
  "product-management:iteration-planning",
  "product-management:increment-review",
  "product-management:retrospective",
  "product-management:three-amigos-review",
  "product-management:feature-document"
]
```

- [ ] **Step 3: Append product-management skills to the management array**

Update the `management` array to:

```json
"management": [
  "superpowers:dispatching-parallel-agents",
  "superpowers:writing-plans",
  "superpowers:executing-plans",
  "product-management:iteration-planning",
  "product-management:retrospective"
]
```

- [ ] **Step 4: Verify valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.flowti/config.json', 'utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 5: Commit**

```bash
git add .flowti/config.json
git commit -m "chore: add product-management skills to skillMap"
```

---

### Task 3: Create foundation file

**Files:**
- Create: `.claude/skills/product-management/_foundation.md`

- [ ] **Step 1: Create the directory**

Run: `mkdir -p .claude/skills/product-management`

- [ ] **Step 2: Write the foundation file**

Write `.claude/skills/product-management/_foundation.md` with the following content:

```markdown
---
name: _foundation
description: Shared patterns for product management ceremony skills (not directly invocable)
user-invocable: false
---

# Product Management — Shared Foundation

This file is loaded by each ceremony skill at startup. It documents common patterns for context gathering, CLI commands, iteration status management, and artifact handling.

## Resolving the Project Root

Before gathering context, resolve the project root path:

1. Read `.flowti/config.json` → `source` field (e.g., `"01 - Projects/Flowti CLI"`)
2. All `<project>` placeholders below resolve to this path (relative to vault root)
3. The vault root is the git root (e.g., `c:\Projects\flowti`)

If the user specifies a different project, use that project's path instead.

## Context Gathering

Every ceremony starts with these steps. Since iteration and agent management are interactive-only (no non-interactive CLI equivalents), skills use **direct file reading** via Claude Code tools.

### Read Iteration State

1. **Find iteration plans**: Glob `<project>/iterations/iteration-*-plan.md`
2. **Read each plan file**: Parse YAML frontmatter for:
   - `name`, `number`, `status`, `startDate`, `endDate`, `goal`
   - `agents` array (format: `Agent Name|agent-filename.md`)
   - `resources` array (format: `name|role|allocation`)
3. **Parse scope items**: In the `## Scope Items` section, count `- [x]` (done) and `- [ ]` (open) checkboxes
4. **Compute completion %**: `done / (done + open) * 100`
5. **Identify current iteration**: The one with `status: in-progress` or the highest-numbered `new`/`planned` iteration

### Read Agent Roster

1. **Find agent files**: Glob `03 - Resources/Agents/*.md` (vault-root-relative, NOT project-relative). **Exclude** files ending in `.prompt.md` — those are system prompts, not agent definitions. Filter by `type: Agent` in frontmatter.
2. **Read each agent file**: Parse YAML frontmatter for:
   - `name`, `agentType` (ai/human), `domain`, `description`
   - `skills` array (format: `Skill Name|level`)
   - `roles` array
   - `preferredPhases` array (e.g., `[new, planned, in-review]`)
   - `suggestedTasks` array (format: `Task description|phase1,phase2`)

### Read Management Domain Files

All paths below are relative to `<project>` (resolved from `.flowti/config.json` → `source`):

- **Requirements**: Glob `<project>/docs/requirements/*.md`
- **Deliverables**: Glob `<project>/docs/deliverables/*.md`
- **RAID items**: Glob `<project>/docs/raid/*.md`
- **CAPA items**: Glob `<project>/docs/capa/*.md`
- **Feature docs**: Glob `<project>/docs/features/*.md`
- **Reports**: Glob `03 - Resources/Reports/*` (vault-root-relative)

### Read Config

- **Project config**: Read `01 - Projects/Flowti CLI/configs/flowti.config.json` for management dirs, orchestration phases, report generators, health thresholds
- **Vault config**: Read `.flowti/config.json` for agent dir, skillMap

## Available CLI Commands

Only these non-interactive commands are available during ceremonies:

| Command | Purpose |
|---------|---------|
| `flowti reports --project="<project>"` | Run all registered report generators |
| `flowti health --project="<project>" --format=json` | Quality gate summary |
| `flowti info --project="<project>" --format=json` | Project diagnostics |
| `flowti test --project="<project>"` | Run tests |
| `flowti build --project="<project>"` | Build project |
| `flowti dev:lint --project="<project>"` | Lint check |

All commands must be run from the git root. The `--project` flag takes the project name (e.g., `"Flowti CLI"`), which maps to the `source` field in `.flowti/config.json`. Resolve the project name at the start of each ceremony — ask the user if not obvious from context.

**Not available as CLI commands** (use direct file reading instead): iteration CRUD, agent management, brief generation, scope management.

## Iteration Status Management

Iterations use `IterationStatus` — a **separate system** from `LifecycleState` (which manages projects/products/features via `lifecycle:*` commands).

**Valid iteration statuses**: `new`, `planned`, `ready`, `in-progress`, `in-review`, `done`, `cancelled`

**Valid transitions**: `new → planned → ready → in-progress → in-review → done`

**To update status**: Edit the iteration plan file's YAML frontmatter `status` field directly using the Edit tool. Never use `lifecycle:transition` for iterations.

**To record a transition**: Add a row to the `## Transition History` table in the plan file:

```markdown
| 2026-03-15 | planned | ready | Scope confirmed, agents assigned |
```

## Hybrid Automation Pattern

Each ceremony skill follows the hybrid pattern:

**Automate** (no human input needed):
- Reading iteration state, scope items, agent roster
- Computing metrics (velocity, completion %, coverage)
- Generating reports via `flowti reports`
- Listing candidate items for review
- Checking gate conditions
- Writing artifact files

**Pause for human** (present data, ask for decision):
- Prioritization and ordering decisions
- Scope commitments (what to include/exclude)
- Estimates and sizing
- Accept/reject judgments on completed work
- Retrospective reflections and insights
- Go/no-go decisions at phase gates

## Artifact Commit Pattern

After producing ceremony artifacts:

1. Stage only the specific files created or modified (use `git add <file1> <file2>`)
2. Commit message format: `chore(iteration-N): <ceremony> — <summary>`
   - Examples:
     - `chore(iteration-5): backlog-refinement — refined 7 items, prioritized for next iteration`
     - `chore(iteration-5): retrospective — captured 4 action items, created 2 CAPAs`
     - `chore: feature-document — created agent-management feature doc`
3. Do NOT push unless the user explicitly asks

## Agent Resolution

How to identify the right agents for each ceremony:

| Ceremony | Key Agents | Resolution Method |
|----------|-----------|-------------------|
| Backlog refinement | Product Owner, Business Analyst | Agents with `preferredPhases` including `new` |
| Iteration planning | Product Owner, Software Architect, Delivery Manager | PO for scope, Architect for tasks, DM for capacity |
| Increment review | Product Owner, Tester, Delivery Manager | Agents with `preferredPhases` including `in-review` |
| Retrospective | Scrum Master, Product Owner, Software Developer | Full team — all agents who participated |
| Three Amigos | Product Owner, Software Architect, Tester | Always these three minimum |
| Feature document | Product Owner, Product Manager | Product domain agents |

Resolution steps:
1. Read orchestration config from `flowti.config.json` → `management.iterations.orchestration.phases`
2. Read agent definitions from `03 - Resources/Agents/*.md`
3. Match agents to ceremony via `preferredPhases` and `roles`

## Iteration Plan File Format Reference

Plans live in `<project>/iterations/iteration-NNN-plan.md`.

**Frontmatter**:
```yaml
---
type: IterationPlan
name: Iteration Name
number: 5
status: in-progress
startDate: 2026-03-14
endDate: 2026-03-28
goal: One-sentence goal statement
agents:
  - Agent Name|agent-filename.md
---
```

**Scope items section**:
```markdown
## Scope Items

- [ ] First scope item description
- [x] Completed scope item description
- [ ] Another open item
```

## Agent Brief File Format Reference

Briefs live in `<project>/iterations/briefs/`.

**Filename**: `iteration-NNN-{slugified-agent}--{slugified-phase}.md`
- Example: `iteration-005-product-owner--new.md`
- Slugify: lowercase, replace non-alphanumeric with `-`, trim leading/trailing `-`

**Frontmatter**:
```yaml
---
agent: Product Owner
iteration: 5
phase: new
status: open
---
```
```

- [ ] **Step 3: Verify the file exists and has correct frontmatter**

Run: `head -5 .claude/skills/product-management/_foundation.md`
Expected: lines showing `---`, `name: _foundation`, `description:...`, `user-invocable: false`, `---`

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/product-management/_foundation.md
git commit -m "feat: add product-management foundation file for ceremony skills"
```

---

## Chunk 2: Ceremony Skills — Backlog Refinement, Iteration Planning, Increment Review (Tasks 4-6)

### Task 4: Create backlog-refinement skill

**Files:**
- Create: `.claude/skills/product-management/backlog-refinement.md`

- [ ] **Step 1: Write the skill file**

Write `.claude/skills/product-management/backlog-refinement.md` with the following content:

```markdown
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
- Read `.claude/skills/product-management/_foundation.md`

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
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -5 .claude/skills/product-management/backlog-refinement.md`
Expected: `---`, `name: backlog-refinement`, `description:...`, `user-invocable: true`, `---`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/product-management/backlog-refinement.md
git commit -m "feat: add backlog-refinement ceremony skill"
```

---

### Task 5: Create iteration-planning skill

**Files:**
- Create: `.claude/skills/product-management/iteration-planning.md`

- [ ] **Step 1: Write the skill file**

Write `.claude/skills/product-management/iteration-planning.md` with the following content:

```markdown
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
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -5 .claude/skills/product-management/iteration-planning.md`
Expected: `---`, `name: iteration-planning`, `description:...`, `user-invocable: true`, `---`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/product-management/iteration-planning.md
git commit -m "feat: add iteration-planning ceremony skill"
```

---

### Task 6: Create increment-review skill

**Files:**
- Create: `.claude/skills/product-management/increment-review.md`

- [ ] **Step 1: Write the skill file**

Write `.claude/skills/product-management/increment-review.md` with the following content:

```markdown
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
- Read `.claude/skills/product-management/_foundation.md`

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
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -5 .claude/skills/product-management/increment-review.md`
Expected: `---`, `name: increment-review`, `description:...`, `user-invocable: true`, `---`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/product-management/increment-review.md
git commit -m "feat: add increment-review ceremony skill"
```

---

## Chunk 3: Ceremony Skills — Retrospective, Three Amigos, Feature Document (Tasks 7-9)

### Task 7: Create retrospective skill

**Files:**
- Create: `.claude/skills/product-management/retrospective.md`

- [ ] **Step 1: Write the skill file**

Write `.claude/skills/product-management/retrospective.md` with the following content:

```markdown
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
- Read `.claude/skills/product-management/_foundation.md`

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
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -5 .claude/skills/product-management/retrospective.md`
Expected: `---`, `name: retrospective`, `description:...`, `user-invocable: true`, `---`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/product-management/retrospective.md
git commit -m "feat: add retrospective ceremony skill"
```

---

### Task 8: Create three-amigos-review skill

**Files:**
- Create: `.claude/skills/product-management/three-amigos-review.md`

- [ ] **Step 1: Write the skill file**

Write `.claude/skills/product-management/three-amigos-review.md` with the following content:

```markdown
---
name: three-amigos-review
description: Run a Three Amigos review — align Product Owner, Architect, and Tester perspectives on a scope item before it moves forward
user-invocable: true
---

# Three Amigos Review

Guide a Three Amigos review for one or more scope items. Ensures alignment between the Product Owner (value & acceptance criteria), Software Architect (technical approach & risks), and Tester (verification & edge cases) before a scope item advances.

**Iteration status context:** Any phase gate — used when a scope item needs alignment before moving forward.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/skills/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Ask the user which scope item(s) to review. Accept either:
   - A scope item description (text match against current iteration plan)
   - An iteration number + item index
   - "all open items" for a batch review
2. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
3. Read the current iteration plan from `<project>/iterations/iteration-*-plan.md`
4. For each selected scope item, read:
   - Related requirements from `<project>/docs/requirements/*.md` (Grep for the item text)
   - Related deliverables from `<project>/docs/deliverables/*.md`
   - Related RAID items from `<project>/docs/raid/*.md`
5. Read the three agent definitions from `03 - Resources/Agents/` (vault-root-relative). Glob for `*.md` and exclude `*.prompt.md` files. Find agents by matching `name` in frontmatter:
   - Product Owner (`product-owner.md`) — for value/acceptance perspective
   - Software Architect (`software-architect.md`) — for technical/decomposition perspective
   - Tester (`tester.md`) — for verification/edge-case perspective

### Step 2: Present the Scope Item (automated)

For each scope item under review, present:

**Scope Item:** [description from plan]

**Current State:**
- Status: [ ] open / [x] done
- Iteration: #N, phase: [current status]
- Estimate: [if available]
- Priority: [if available]

**Existing Acceptance Criteria:**
- [list any existing criteria, or "None defined yet"]

**Related Items:**
- Requirements: [linked requirement files, or "None"]
- Deliverables: [linked deliverable files, or "None"]
- RAID: [linked risks/issues, or "None"]

### Step 3: Three Perspectives Loop (human-driven)

Walk through each perspective one at a time. For each, the skill **suggests** answers based on available data, then asks the user to **confirm, adjust, or replace**.

#### Product Owner Lens

Based on the Product Owner agent's skills (Scope Definition, Acceptance Criteria Writing, Story Mapping):

1. **"Is the value of this item clear? What problem does it solve and for whom?"**
   - Suggest a value statement based on the item description and related requirements
2. **"Are the acceptance criteria complete?"**
   - Suggest acceptance criteria based on the description. Each criterion should be:
     - Specific and testable
     - Expressed as "Given [context], when [action], then [outcome]"
   - Ask user to confirm/adjust
3. **"Is the priority correct?"**
   - Present current priority (if set) and ask if it should change

#### Software Architect Lens

Based on the Software Architect agent's skills (System Architecture, API Design, Technical Risk Assessment):

1. **"Is the technical approach clear? What's the high-level design?"**
   - Suggest an approach based on the item description and codebase patterns
2. **"What are the technical risks?"**
   - Flag potential risks: dependencies, complexity, unknown areas, performance concerns
3. **"How should this be decomposed into tasks?"**
   - Suggest a task breakdown with file-level changes
   - Ask user to confirm/adjust

#### Tester Lens

Based on the Tester agent's skills (Test Planning, Exploratory Testing, Risk-Based Testing):

1. **"How will we verify this? What test scenarios are needed?"**
   - Suggest test scenarios covering:
     - Happy path
     - Edge cases
     - Error cases
     - Integration points
2. **"What edge cases matter most?"**
   - Flag boundary conditions, null/empty inputs, concurrent access, etc.
3. **"What's the test approach?"**
   - Suggest: unit tests, integration tests, manual verification, or combination

### Step 4: Alignment Checkpoint (human-driven)

Present a consolidated view of all three perspectives:

```
## Alignment Summary

### Value & Acceptance (Product Owner)
- Value: [statement]
- Acceptance Criteria:
  - [ ] Criterion 1
  - [ ] Criterion 2

### Technical Approach (Software Architect)
- Design: [high-level approach]
- Risks: [flagged risks]
- Tasks: [breakdown]

### Verification (Tester)
- Test scenarios: [list]
- Edge cases: [list]
- Approach: [unit/integration/manual]
```

Ask: **"Are all three perspectives aligned? Any unresolved disagreements?"**

- If **disagreements exist**: capture each disagreement, present them, and ask the user to resolve one at a time
- If **aligned**: proceed to produce the record

### Step 5: Produce Review Record (automated)

1. Update the scope item in the iteration plan with refined acceptance criteria (if they changed)
2. Write the Three Amigos record to `<project>/iterations/three-amigos-<item-slug>-YYYY-MM-DD.md`:
   - `<item-slug>`: slugify the first 5 words of the scope item description

```markdown
---
type: ThreeAmigosReview
iteration: N
scopeItem: "Item description"
date: YYYY-MM-DD
aligned: true/false
---

# Three Amigos Review — [Item Description]

## Scope Item

[Full description]

## Product Owner Perspective

- **Value**: [statement]
- **Acceptance Criteria**:
  - [ ] Criterion 1
  - [ ] Criterion 2

## Software Architect Perspective

- **Technical Approach**: [design]
- **Risks**: [list]
- **Task Breakdown**:
  - [ ] Task 1
  - [ ] Task 2

## Tester Perspective

- **Test Scenarios**:
  - [ ] Scenario 1
  - [ ] Scenario 2
- **Edge Cases**: [list]
- **Test Approach**: [approach]

## Alignment

- Status: Aligned / Disagreements resolved
- [Any notes on resolved disagreements]
```

3. If the item is ready to advance, suggest updating the iteration status in the plan frontmatter
4. Commit all artifacts:
   ```
   git add "01 - Projects/Flowti CLI/iterations/three-amigos-*.md" "01 - Projects/Flowti CLI/iterations/iteration-NNN-plan.md"
   git commit -m "chore(iteration-N): three-amigos — reviewed [item slug], aligned"
   ```
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -5 .claude/skills/product-management/three-amigos-review.md`
Expected: `---`, `name: three-amigos-review`, `description:...`, `user-invocable: true`, `---`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/product-management/three-amigos-review.md
git commit -m "feat: add three-amigos-review ceremony skill"
```

---

### Task 9: Create feature-document skill

**Files:**
- Create: `.claude/skills/product-management/feature-document.md`

- [ ] **Step 1: Write the skill file**

Write `.claude/skills/product-management/feature-document.md` with the following content:

```markdown
---
name: feature-document
description: Curate a feature document with customer-facing content and internal engineering reference — single source of truth for both audiences
user-invocable: true
---

# Feature Document

Guide the creation of a feature document that serves both external (customer-facing) and internal (engineering) audiences. Product management curates the external narrative; internal sections are auto-populated from linked requirements, deliverables, and iteration data.

**Iteration status context:** Anytime — not tied to a specific iteration state.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/skills/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
2. Read `<project>/configs/flowti.config.json` → `management.features.dir` to determine output location (default: `docs/features`)
2. Ask the user: **"Which feature do you want to document?"**
   - Accept a feature name (free text)
   - Or a link to an existing requirement/deliverable
3. If linked to existing items:
   - Read requirement files from `<project>/docs/requirements/*.md` — Grep for the feature name
   - Read deliverable files from `<project>/docs/deliverables/*.md` — Grep for the feature name
   - Read iteration plans to find scope items related to this feature
   - Parse user stories, acceptance criteria, status from the linked items
4. Read existing feature docs from the features dir to check if this feature already has a document (update vs. create)

### Step 2: Document Scaffold (hybrid)

Generate the initial scaffold. The document has two audience zones clearly separated:

**Template:**

```markdown
---
name: [Feature Name]
status: draft
created: YYYY-MM-DD
iteration: [Iteration Name, if linked]
requirements: [linked requirement file paths]
deliverables: [linked deliverable file paths]
---

# [Feature Name]

> [One-line tagline — what this feature is in plain language]

---

## Value Proposition

[What problem does this feature solve? Who benefits? Why does it matter?]

## Key Capabilities

- [Capability 1 — what the feature does, in user terms]
- [Capability 2]
- [Capability 3]

## Usage Examples

### [Example 1: Scenario Name]

[Concrete scenario showing the feature in action. Include commands, inputs, expected outputs where relevant.]

### [Example 2: Scenario Name]

[Another scenario for a different use case.]

## Known Limitations

- [Limitation 1 — honest about what the feature doesn't do yet]
- [Limitation 2]

---

<!-- Internal Reference — Engineering Only -->

## User Stories

[Auto-populated from linked requirements. Format:]

- **As a** [role], **I want to** [goal], **so that** [benefit]
  - Status: [draft/proposed/approved/implemented/verified]
  - Acceptance Criteria:
    - [ ] Criterion 1
    - [ ] Criterion 2

## Technical Notes

- **Architecture**: [How this feature fits into the system]
- **Dependencies**: [What it depends on]
- **Constraints**: [Technical limitations or requirements]

## Implementation Status

| Deliverable | Status | Iteration | Completion |
|-------------|--------|-----------|------------|
| [linked deliverable] | [status] | [iteration] | [%] |

## Success Metrics

- [Metric 1: how we measure whether this feature achieves its goal]
- [Metric 2]
```

### Step 3: Content Curation Loop (human-driven)

Walk through each **external section** one at a time:

1. **Tagline**: Draft a one-liner based on available data. Ask: **"Does this capture the essence? How would you phrase it?"**
2. **Value Proposition**: Draft based on requirement descriptions and user stories. Ask the user to refine the voice, emphasis, and framing
3. **Key Capabilities**: List capabilities from acceptance criteria and deliverables. Ask: **"Are these the right capabilities to highlight? Anything to add or remove?"**
4. **Usage Examples**: Draft concrete scenarios. Ask: **"Do these examples resonate? What scenarios would be most useful for users?"**
5. **Known Limitations**: Flag any constraints from RAID items or technical notes. Ask: **"What limitations should we be upfront about?"**

For **internal sections**:
- Auto-populate from linked items where possible
- Present to user for verification: **"I've populated the internal sections from [N requirements, M deliverables]. Please verify this is accurate."**
- User can adjust any section

### Step 4: Produce Feature Document (automated)

1. Determine the output path:
   - Read `management.features.dir` from config (default: `docs/features`)
   - Slugify the feature name: lowercase, replace spaces/special chars with `-`
   - Full path: `<project>/<features-dir>/<feature-slug>.md`

2. Write the document with all curated content

3. Set frontmatter `status`:
   - `draft` — initial creation, not yet reviewed
   - `review` — content reviewed by product management
   - `published` — approved for external consumption
   - Ask the user: **"What status should this document have?"** (default: `draft`)

4. Commit:
   ```
   git add "01 - Projects/Flowti CLI/<features-dir>/<feature-slug>.md"
   git commit -m "chore: feature-document — created [feature-name] feature doc"
   ```
```

- [ ] **Step 2: Verify frontmatter**

Run: `head -5 .claude/skills/product-management/feature-document.md`
Expected: `---`, `name: feature-document`, `description:...`, `user-invocable: true`, `---`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/product-management/feature-document.md
git commit -m "feat: add feature-document curation skill"
```

---

## Chunk 4: Validation

### Task 10: Validate all skills

- [ ] **Step 1: Verify all 7 files exist**

Run: `ls -la .claude/skills/product-management/`

Expected: 7 files:
```
_foundation.md
backlog-refinement.md
feature-document.md
increment-review.md
iteration-planning.md
retrospective.md
three-amigos-review.md
```

- [ ] **Step 2: Verify frontmatter of all skill files**

For each file, verify:
- `_foundation.md` has `user-invocable: false`
- All 6 ceremony files have `user-invocable: true`
- All files have `name` and `description` fields

Run: `for f in .claude/skills/product-management/*.md; do echo "=== $f ==="; head -5 "$f"; echo; done`

- [ ] **Step 3: Verify config changes**

Check `.flowti/config.json` skillMap has the new entries:
Run: `node -e "const c = JSON.parse(require('fs').readFileSync('.flowti/config.json','utf8')); console.log('product:', c.agents.skillMap.product.length, 'entries'); console.log('management:', c.agents.skillMap.management.length, 'entries')"`

Expected:
- product: 8 entries (2 existing + 6 new)
- management: 5 entries (3 existing + 2 new)

Check `flowti.config.json` has features dir and retro generator:
Run: `node -e "const c = JSON.parse(require('fs').readFileSync('01 - Projects/Flowti CLI/configs/flowti.config.json','utf8')); console.log('features:', c.management.features); console.log('generators:', c.reports.generators.map(g=>g.id).join(', '))"`

Expected:
- features: `{ dir: 'docs/features' }`
- generators includes `iteration-retrospective`

- [ ] **Step 4: Final commit (if any uncommitted validation fixes)**

```bash
git status
# If clean, skip. Otherwise:
git add -A && git commit -m "chore: fix validation issues in product-management skills"
```

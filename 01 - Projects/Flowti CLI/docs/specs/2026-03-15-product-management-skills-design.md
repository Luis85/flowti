# Product Management Skills — Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Scope:** 6 Claude Code skills for product management ceremonies + 1 shared foundation

## Problem

The product team (Product Owner, Product Manager, Scrum Master, Delivery Manager) runs recurring ceremonies — backlog refinement, iteration planning, increment reviews, retrospectives, and Three Amigos reviews — plus creates feature documents. Today these are manual, ad-hoc processes. The Flowti CLI already has the domain infrastructure (iterations, lifecycle, agents, reports, requirements, deliverables, RAID, CAPA) but no guided workflows that tie it together.

## Solution

Create 6 user-invocable Claude Code skills and 1 shared foundation file under `.claude/skills/product-management/`. Each skill is a hybrid ceremony guide: it automates data gathering, report generation, and artifact creation, but pauses at decision points for human judgment.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Skill location | Local project skills (`.claude/skills/product-management/`) | Tightly coupled to Flowti CLI commands and conventions |
| Automation model | Hybrid (automate data, pause at decisions) | Ceremonies need human judgment at key moments |
| Invocation model | Standalone + agent-dispatched (both) | Usable by humans directly and via `skillMap` injection |
| Feature document format | Hybrid (external + internal sections) | Single source of truth for both audiences |
| Feature document location | Configurable via `management.features.dir` | Follows existing management domain pattern |
| Lifecycle mapping | Each ceremony maps to specific lifecycle states | Natural fit with existing iteration lifecycle |

## File Structure

```
.claude/skills/product-management/
  _foundation.md              # Shared patterns (NOT user-invocable)
  backlog-refinement.md       # /product-management:backlog-refinement
  iteration-planning.md       # /product-management:iteration-planning
  increment-review.md         # /product-management:increment-review
  retrospective.md            # /product-management:retrospective
  three-amigos-review.md      # /product-management:three-amigos-review
  feature-document.md         # /product-management:feature-document
```

## Iteration Status vs. Lifecycle State

**Important distinction:** Iterations use `IterationStatus` (`new`, `planned`, `ready`, `in-progress`, `in-review`, `done`, `cancelled`) — a separate system from the generic `LifecycleState` used by `lifecycle:*` CLI commands (which manage projects, products, and features only). Skills must never use `lifecycle:transition` to advance iteration status. Iteration status is managed by editing the iteration plan markdown file's frontmatter directly.

## Lifecycle Mapping

| Skill | Trigger Point | Iteration Status Context |
|-------|--------------|--------------------------|
| `backlog-refinement` | Before/during `new` | Groom incoming items, clarify scope, estimate, prioritize |
| `iteration-planning` | `new → planned` transition | Commit to scope, assign agents, set capacity, produce plan |
| `increment-review` | `in-review` phase | Demo completed work, verify scope items, gather feedback |
| `retrospective` | After `done` | Reflect on process, generate CAPA items, update velocity |
| `three-amigos-review` | Any phase gate | PO + Architect + Tester align on a scope item |
| `feature-document` | Anytime | Curate customer-facing + internal feature documentation |

## Config Changes

### `.flowti/config.json` — skillMap additions (additive)

Append these entries to the existing `skillMap` arrays. Do not replace existing entries.

```json
"product": [
  // existing: "superpowers:brainstorming", "superpowers:writing-plans"
  // append:
  "product-management:backlog-refinement",
  "product-management:iteration-planning",
  "product-management:increment-review",
  "product-management:retrospective",
  "product-management:three-amigos-review",
  "product-management:feature-document"
],
"management": [
  // existing: "superpowers:dispatching-parallel-agents", "superpowers:writing-plans", "superpowers:executing-plans"
  // append:
  "product-management:iteration-planning",
  "product-management:retrospective"
]
```

### `flowti.config.json` — management.features

Add to the existing `management` section. The `dir` path is relative to the project root (consistent with all other management dirs like `docs/deliverables`, `docs/requirements`, etc.).

```json
"management": {
  "features": { "dir": "docs/features" }
}
```

---

## Foundation (`_foundation.md`)

The foundation is a non-invocable shared reference loaded by each ceremony skill at startup. It contains:

### 1. Context Gathering

Standard steps every ceremony starts with. Since iteration and agent management commands are interactive-only (no non-interactive CLI equivalents), skills use **direct file reading** via Claude Code tools (Read, Glob, Grep).

- **Read iteration plans**: Glob `<project>/iterations/iteration-*-plan.md`, then Read each file to parse frontmatter (name, number, status, startDate, endDate, goal, agents) and scope items (`- [x]`/`- [ ]` checkboxes)
- **Read iteration scope**: Parse scope items from plan files, compute completion %
- **Resolve agent roster**: Glob `03 - Resources/Agents/*.md` (vault-root-relative, not project-root-relative), Read each to parse frontmatter (type, domain, skills, roles, preferredPhases)
- **Read iteration status**: Parse the `status` field from the iteration plan frontmatter (values: `new`, `planned`, `ready`, `in-progress`, `in-review`, `done`, `cancelled`)
- **Read recent reports**: Glob `03 - Resources/Reports/*` for latest generated data

### 2. Available CLI Commands

Only these non-interactive CLI commands are available for ceremony use:

- **Report generation**: `flowti reports --project="<project>"` — runs all registered report generators
- **Health check**: `flowti health --project="<project>" --format=json` — quality gate summary
- **Project info**: `flowti info --project="<project>" --format=json` — project diagnostics
- **Test/Build/Lint**: `flowti test`, `flowti build`, `flowti dev:lint` — quality checks

Iteration CRUD, agent management, and brief generation are **not available** as non-interactive commands. Skills must read/write markdown files directly using Claude Code tools (Read, Write, Edit, Glob, Grep).

### 3. Iteration Status Updates

To update iteration status, edit the iteration plan file's frontmatter directly:
- Read the plan file → parse frontmatter → update `status` field → Write back
- Valid transitions follow the `IterationStatus` state machine: `new → planned → ready → in-progress → in-review → done`
- Do NOT use `lifecycle:transition` — that command manages projects/products/features, not iterations

### 4. Hybrid Pattern

When to automate vs. pause:

- **Automate:** Reading state, pulling metrics, generating reports, computing velocity, listing scope items, checking gate conditions
- **Pause for human:** Prioritization decisions, scope commitments, retrospective insights, go/no-go calls, acceptance of demo items

### 5. Artifact Commit Pattern

After producing artifacts:

- Stage only the specific files created/modified
- Commit message format: `chore(iteration-N): <ceremony> — <summary>`
- Do not push unless explicitly asked

### 6. Agent Resolution

How to identify the right agents for a ceremony:

- Map ceremony to `preferredPhases` from agent definitions
- Three Amigos always involves: Product Owner + Software Architect + Tester (minimum)
- Iteration planning involves: Product Owner (scope) + Software Architect (tasks) + Delivery Manager (capacity)

---

## Skill 1: Backlog Refinement

**Invocation:** `/product-management:backlog-refinement`
**Lifecycle:** Before/during `new` phase

### Workflow

1. **Gather context** (automated)
   - Run foundation context gathering (direct file reads)
   - Read current iteration plan + scope items from `iterations/iteration-*-plan.md`
   - Glob + Read requirements from `docs/requirements/` for ungroomed items
   - Read deliverables from `docs/deliverables/` for anything blocked or overdue
   - Read RAID items from `docs/raid/` for risks/issues that may affect prioritization

2. **Present backlog snapshot** (automated)
   - Table of candidate items: source (requirement, deliverable, RAID, ad-hoc), status, rough size
   - Flag items missing acceptance criteria, missing estimates, or unclear scope
   - Highlight dependencies between items

3. **Refinement loop** (human-driven, per item)
   - For each item: "Is this clear enough to estimate? What's missing?"
   - If unclear → ask clarifying questions, capture answers as updated description
   - If clear → ask for estimate (T-shirt size: S/M/L/XL) and MoSCoW priority
   - Human can skip, split, merge, or reject items

4. **Prioritized backlog output** (automated)
   - Produce a ranked list with estimates and priorities
   - Update requirement/deliverable markdown files directly if items were clarified
   - Write session summary to `iterations/refinement-<date>.md`
   - Commit artifact

**Decision points (human):** Which items to refine, estimates, priority, scope splits.

---

## Skill 2: Iteration Planning

**Invocation:** `/product-management:iteration-planning`
**Lifecycle:** `new → planned` transition

### Workflow

1. **Gather context** (automated)
   - Foundation context gathering
   - Read refined backlog (from most recent refinement session or current scope items)
   - Read team capacity: agent roster with `preferredPhases` and `capacities` entries
   - Read previous iteration velocity (from `iteration-retrospective` report if available)
   - Check iteration gates for `planned` state (`has-goal`, `has-scope`, `has-dates`)

2. **Present planning inputs** (automated)
   - Iteration goal (from existing definition or ask to set one)
   - Available capacity table: agents, roles, phases they cover
   - Velocity reference: previous iteration completion rate, average items delivered
   - Candidate scope items: ranked by priority from refinement

3. **Scope commitment** (human-driven)
   - Present top-N items that fit within velocity/capacity
   - Ask: "Which items do you commit to for this iteration?"
   - For each committed item, confirm acceptance criteria are clear
   - Human can add, remove, or adjust items

4. **Task breakdown** (hybrid)
   - For each committed scope item, suggest breakdown into tasks (Software Architect perspective)
   - Ask human to confirm/adjust task list per item
   - Assign agents to phases based on `preferredPhases` + orchestration config

5. **Produce iteration plan** (automated)
   - Create/update iteration plan markdown file in `iterations/iteration-NNN-plan.md`
   - Set scope items, dates, assigned agents in frontmatter and body
   - Update iteration status to `planned` in the plan file's frontmatter
   - Generate agent brief markdown files in `iterations/briefs/`
   - Commit all artifacts

**Decision points (human):** Goal confirmation, scope commitment, task breakdown approval, agent assignment overrides.

---

## Skill 3: Increment Review

**Invocation:** `/product-management:increment-review`
**Lifecycle:** During `in-review` phase

### Workflow

1. **Gather context** (automated)
   - Foundation context gathering
   - Read iteration scope items with completion status (done/not done)
   - Read deliverables status for this iteration
   - Pull git log for the iteration period (`git log --after=<startDate> --before=<endDate>`)
   - Run `flowti reports --project="<project>"` for fresh metrics
   - Check quality gates via review domain (coverage, security, risk gates)

2. **Present increment summary** (automated)
   - Scope completion table: each item, done/not done, linked deliverables
   - Metrics dashboard: tests passing, coverage %, lint status, build status
   - Commit activity summary: number of commits, files changed, contributors
   - Quality gate status: which gates pass/fail

3. **Demo walkthrough** (human-driven, per scope item)
   - For each completed scope item: "Does this meet acceptance criteria?"
   - Human marks each as: **accepted**, **accepted with notes**, or **rejected**
   - Rejected items get a reason captured and are carried back to backlog
   - Accepted-with-notes items get follow-up tasks created

4. **Stakeholder feedback capture** (human-driven)
   - Ask: "Any feedback, new ideas, or concerns from this review?"
   - Capture as new backlog items (requirements or deliverables) with source tagged as `increment-review`

5. **Produce review record** (automated)
   - Write review summary to `iterations/iteration-NNN-review.md`
   - Update scope items (mark accepted/rejected)
   - Create follow-up items for rejections and feedback
   - Commit artifacts

**Decision points (human):** Accept/reject per scope item, feedback capture, follow-up prioritization.

---

## Skill 4: Retrospective

**Invocation:** `/product-management:retrospective`
**Lifecycle:** After iteration reaches `done`

### Workflow

1. **Gather context** (automated)
   - Foundation context gathering
   - Generate fresh reports via `flowti reports --project="<project>"` (note: `iteration-retrospective` generator must be registered in `flowti.config.json` generators array)
   - Read the increment review record (if exists)
   - Pull velocity metrics: scope items committed vs. completed, time spent
   - Read any CAPA items generated during the iteration
   - Read agent participation data from briefs

2. **Present retrospective data** (automated)
   - Velocity summary: committed vs. delivered, completion rate
   - Scope changes: items added/removed mid-iteration
   - Quality metrics: test coverage delta, lint issues, gate pass/fail history
   - Agent utilization: who participated in which phases, brief completion status
   - Timeline: did the iteration hit its dates?

3. **Reflection prompts** (human-driven, one at a time)
   - "What went well this iteration that we should keep doing?"
   - "What didn't go well that we should stop or change?"
   - "What should we try next iteration that we haven't done before?"
   - "Were there any blockers or surprises? What caused them?"
   - "Rate the iteration 1-5. Why?"

4. **Action items** (hybrid)
   - From human responses, suggest concrete action items
   - Ask human to confirm/adjust each
   - For process issues → create CAPA items via the CAPA domain
   - For improvement ideas → capture as backlog items for next iteration
   - For recurring problems → suggest updates to `flowti.config.json` (thresholds, gates, orchestration)

5. **Produce retrospective record** (automated)
   - Write to `iterations/iteration-NNN-retrospective.md`
   - Include: data summary, reflections, action items with owners
   - Update iteration status to `done` in the plan file's frontmatter if not already
   - Commit artifacts

**Decision points (human):** All reflections, action item confirmation, CAPA creation approval.

---

## Skill 5: Three Amigos Review

**Invocation:** `/product-management:three-amigos-review`
**Lifecycle:** Any phase gate

### Workflow

1. **Gather context** (automated)
   - Foundation context gathering
   - Ask which scope item(s) to review (or accept as argument)
   - Read the scope item's current state: description, acceptance criteria, estimate, status
   - Read related requirements, deliverables, and RAID items
   - Resolve the three perspectives: Product Owner, Software Architect, Tester (from agent roster)

2. **Present the scope item** (automated)
   - Current description and acceptance criteria
   - Dependencies and risks
   - Related items (linked requirements, deliverables)
   - Current lifecycle state and proposed next state

3. **Three perspectives loop** (human-driven, one perspective at a time)
   - **Product Owner lens:** "Is the value clear? Are acceptance criteria complete? Is priority correct?"
   - **Software Architect lens:** "Is the technical approach clear? What are the risks? How should this be decomposed into tasks?"
   - **Tester lens:** "How will we verify this? What edge cases matter? What test scenarios are needed?"
   - For each perspective, the skill suggests answers based on available data, then asks human to confirm/adjust

4. **Alignment checkpoint** (human-driven)
   - Present consolidated view: all three perspectives side by side
   - Ask: "Are all three aligned? Any unresolved disagreements?"
   - If disagreements → capture them, ask human to resolve
   - If aligned → proceed

5. **Produce review record** (automated)
   - Update scope item description with refined acceptance criteria
   - Add test scenarios to the item
   - Write Three Amigos record to `iterations/three-amigos-<item-slug>-<date>.md`
   - If the item is ready to advance, suggest updating iteration status in the plan frontmatter
   - Commit artifacts

**Decision points (human):** Acceptance criteria completeness, technical approach, test scenarios, alignment confirmation.

---

## Skill 6: Feature Document

**Invocation:** `/product-management:feature-document`
**Lifecycle:** Anytime (not tied to a specific iteration state)

### Workflow

1. **Gather context** (automated)
   - Foundation context gathering (lightweight — no iteration state required unless linked)
   - Ask which feature to document (name, or link to existing requirement/deliverable)
   - If linked to existing items, pull: requirement definition, user stories, acceptance criteria, deliverable status
   - Read `management.features.dir` from config to determine output location

2. **Document structure** (hybrid)
   - Generate scaffold with two audience zones:

   **External sections (customer-facing, product management curates):**
   - Feature name and tagline
   - Value proposition — what problem it solves and for whom
   - Key capabilities — bullet list of what the feature does
   - Usage examples — concrete scenarios showing the feature in action
   - Known limitations — honest about what it doesn't do (yet)

   **Internal sections (engineering reference):**
   - User stories with acceptance criteria (pulled from requirements if linked)
   - Technical notes — architecture decisions, dependencies, constraints
   - Implementation status — linked deliverables, scope items, iteration
   - Success metrics — how we measure whether this feature achieves its goal

3. **Content curation loop** (human-driven, section by section)
   - For each external section, draft content based on available data
   - Present draft, ask human to refine the voice, emphasis, and framing
   - For internal sections, auto-populate from linked items, ask human to verify

4. **Produce feature document** (automated)
   - Write to `<features-dir>/<feature-slug>.md` with frontmatter:
     ```yaml
     ---
     name: Feature Name
     status: draft | review | published
     created: 2026-03-15
     iteration: Iteration 1  # if linked
     ---
     ```
   - Commit artifact

**Decision points (human):** Feature framing, value proposition wording, capability emphasis, limitation disclosure, status.

---

## Prerequisites

Before skills can function fully:

1. **Register `iteration-retrospective` in the project's `flowti.config.json` `reports.generators[]` array** — the generator is already registered in the code-level `generator-registry.ts`, but it must also appear in `flowti.config.json` for `flowti reports` to execute it during the pipeline. Required by the Retrospective skill.

## Artifact Path Conventions

All artifact paths in skill workflows are **relative to the project root** (e.g., `01 - Projects/Flowti CLI/`):

- Iteration plans/reports: `iterations/iteration-NNN-plan.md`, `iterations/iteration-NNN-report.md`
- Iteration briefs: `iterations/briefs/`
- Ceremony records: `iterations/refinement-<date>.md`, `iterations/iteration-NNN-review.md`, `iterations/iteration-NNN-retrospective.md`, `iterations/three-amigos-<item-slug>-<date>.md`
- Feature documents: `<management.features.dir>/<feature-slug>.md` (default: `docs/features/`)
- Requirements: `docs/requirements/`
- Deliverables: `docs/deliverables/`
- RAID: `docs/raid/`
- Reports output: `03 - Resources/Reports/` (vault-relative)

## Testing Strategy

Skills are Claude Code skill files (markdown), not executable code. Validation is:

1. **Frontmatter validation** — Each skill has correct `name`, `description`, `user-invocable` fields
2. **Invocability test** — Each skill can be invoked via `/product-management:<skill-name>`
3. **Foundation loading** — Each ceremony skill successfully reads `_foundation.md` on startup
4. **File access** — Skills can locate and parse iteration plans, agent definitions, and management domain files
5. **Artifact creation** — Each skill produces its expected output file in the correct location
6. **skillMap integration** — Skills appear in agent briefs when `claude:sync` runs

## Out of Scope

- No changes to the Flowti CLI domain code (iterations, lifecycle, reports, etc.)
- No new CLI commands — skills use direct file reading via Claude Code tools
- No changes to the Obsidian plugin
- No new report generators — skills use existing ones (especially `iteration-retrospective`)
- No UI changes to the interactive sitemap

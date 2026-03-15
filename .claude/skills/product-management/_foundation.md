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

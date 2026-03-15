# Execute-in-Workspace Skill — Design Spec

**Date:** 2026-03-15
**Status:** Approved (spec review passed)
**Author:** Claude + Lum

## Problem Statement

Flowti has a rich plan execution pipeline (brainstorm → spec → plan → execute) and a workspace isolation system (`IAgentShell`, `WorkspaceProvisioner`, `StateSplitter`). But nothing ties them together. Today, plan execution happens in the main vault directory on whatever branch happens to be checked out. This means:

- Execution can interfere with the user's active work
- No feature-branch discipline per plan — branches are created ad-hoc
- No workspace lifecycle tracking for plan execution sessions
- No structured path from "plan done" to "PR created"

The existing `superpowers:executing-plans` + `superpowers:using-git-worktrees` combo is generic — it knows nothing about Flowti's workspace system, iterations, or agent model.

## Goals

1. **Isolated execution** — every plan executes in a provisioned workspace on a dedicated feature branch
2. **Iteration-aware** — branch names and workspace IDs tie to the active iteration
3. **Pre-flight validation** — verify spec, plan, and iteration exist before provisioning
4. **Quality-gated** — tests must pass after each chunk and before PR creation
5. **PR as the default outcome** — execution naturally flows toward a pull request
6. **Consistent with ceremony skills** — same patterns as other `product-management:` skills (foundation file, CLI commands, direct file reading)

## Non-Goals

- Replacing the brainstorming or planning phases (those remain separate skills)
- Multi-agent parallel execution (designed for, not implemented in v1)
- Auto-merging PRs (human reviews PRs)
- Real-time progress streaming to external systems

---

## Skill Identity

| Field | Value |
|-------|-------|
| Name | `execute-in-workspace` |
| Namespace | `product-management` |
| Invocation | `/product-management:execute-in-workspace [plan-path]` |
| User-invocable | `true` |
| Foundation | Reads `_foundation.md` for project root, CLI commands, artifact patterns |

### Skill File Frontmatter

The skill file at `.claude/commands/product-management/execute-in-workspace.md` uses this header:

```yaml
---
name: execute-in-workspace
description: Execute an implementation plan in an isolated agent workspace — provisions a feature branch, runs plan steps, verifies quality gates, and creates a PR when green
user-invocable: true
---
```

---

## Workflow Overview

```
Pre-flight → Provision → Execute → Verify → PR Gate → Collect
```

### Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

### Step 1: Pre-Flight Checks (automated)

Before any workspace work, validate readiness:

1. **Resolve plan** — if `$ARGUMENTS` is a path, use it. Otherwise glob `<project>/docs/plans/*.md` and pick the most recent by filename date prefix.
2. **Verify spec exists** — extract the `Spec:` line from the plan header, confirm the referenced spec file exists. If missing: stop with "No spec found — run brainstorming first."
3. **Verify iteration context** — read iteration plans, find the `in-progress` iteration. If none: stop with "No active iteration — run iteration-planning first."
4. **Verify plan hasn't already been executed** — check if a workspace already exists for this plan (grep workspace registry for matching branch name `feat/iter-N/<plan-slug>`). If found and still `active`: stop with "Workspace already running." If found and `retained`: ask "Resume existing workspace or start fresh?"
5. **Verify clean main branch** — `git status` on the vault root must be clean (no uncommitted changes that would be inherited by the worktree). If dirty: warn and ask whether to proceed or stash first.
6. **Check `gh` CLI availability** — run `gh --version`. If missing: note in pre-flight summary that PR creation will require manual steps. This is a warning, not a blocker.

If all checks pass, display a summary:

```
Pre-flight ✓
  Plan:      2026-03-15-agent-workspace-isolation.md (8 chunks, 18 files)
  Spec:      2026-03-15-agent-workspace-isolation-design.md
  Iteration: #5 "Agents become autonomous" (in-progress)
  Branch:    feat/iter-5/agent-workspace-isolation
  Workspace: ws-plan-agent-wo-a3f2
  gh CLI:    available (for PR creation)

Proceed with workspace provisioning?
```

Wait for user confirmation before provisioning.

### Step 2: Workspace Provisioning (automated)

1. **Derive branch name** — `feat/iter-{N}/{plan-slug}` where:
   - `N` = active iteration number
   - `plan-slug` = plan filename with date prefix stripped (e.g., `2026-03-15-agent-workspace-isolation.md` → `agent-workspace-isolation`)
   - This overrides the default `branchPrefix: "agent/"` from workspace config — the explicit `--branch` flag takes precedence over the configured prefix.

2. **Provision workspace** — this skill provisions the workspace directly using git commands rather than `flowti workspace:provision` (which dispatches a full agent process). The provisioning steps are:
   ```bash
   # From vault root
   git worktree add "<baseDir>/ws-plan-<plan-slug-8chars>-<hex>" -b feat/iter-N/plan-slug master
   ```
   Worktree by default. If the branch already exists (e.g., resuming), clone fallback:
   ```bash
   git clone . "<baseDir>/ws-plan-<plan-slug-8chars>-<hex>"
   cd "<baseDir>/ws-plan-<plan-slug-8chars>-<hex>"
   git checkout -b feat/iter-N/plan-slug
   ```
   The `baseDir` is read from `.flowti/config.json` → `workspaces.baseDir` (default: `../flowti-agents`).

   **Working directory context:** After provisioning, all subsequent Bash commands use the workspace path as their working directory. File reads/edits use absolute paths within the workspace. The vault root is not touched until the collect phase.

3. **Register in workspace registry** — write a JSON entry to `.flowti/var/workspace-registry.json` in the vault root so that `workspace:collect` and `workspace:inspect` can find this workspace later:
   ```json
   {
     "id": "ws-plan-<slug-8>-<hex>",
     "agentSlug": "plan-executor",
     "branch": "feat/iter-N/plan-slug",
     "baseBranch": "master",
     "method": "worktree",
     "state": "active",
     "path": "<absolute workspace path>",
     "retain": true,
     "createdAt": "<ISO 8601>"
   }
   ```
   This keeps the workspace system aware of skill-provisioned workspaces. The `agentSlug: "plan-executor"` is a convention — it doesn't require a matching agent definition file.

4. **Install dependencies** — run `npm install` inside `<workspace>/<project>/` (e.g., `<workspace>/01 - Projects/Flowti CLI/`).

5. **Verify clean baseline** — from the workspace project dir:
   ```bash
   npx tsc --noEmit --project configs/tsconfig.json
   npx vitest run --config configs/vitest.config.ts
   npx eslint src/ --config configs/eslint.config.mjs
   ```
   If any fail: stop and report. Don't proceed with a broken baseline.

6. **Report ready:**
   ```
   Workspace ready
     Path:   C:\Projects\flowti-agents\ws-plan-agent-wo-a3f2
     Branch: feat/iter-5/agent-workspace-isolation
     Base:   master
     Tests:  5920 passing, 0 failures

   Starting plan execution...
   ```

All subsequent work happens inside the workspace directory. The vault root remains untouched.

### Step 3: Plan Execution (automated)

The core loop — read the plan and execute it chunk by chunk:

1. **Parse plan structure** — read the plan file, identify chunks/tasks by `## Chunk` or `### Task` headers. Count total steps (`- [ ]` checkboxes).

2. **For each chunk, sequentially:**
   - Display chunk header and step count
   - Execute each step following the plan's instructions exactly (create files, modify files, run commands)
   - After each step, mark its checkbox `- [x]` in the plan file within the workspace
   - Commit after each completed chunk:
     ```bash
     git add <changed files>
     git commit -m "feat(iter-N): <chunk summary>"
     ```

3. **Quality gate after each chunk** — run the project test suite:
   ```bash
   npx vitest run --config configs/vitest.config.ts
   npx tsc --noEmit --project configs/tsconfig.json
   ```
   - If green: continue to next chunk
   - If red: stop, display failures, attempt to fix. If fix fails after 2 attempts: stop and surface to user with "Chunk N broke tests — need guidance"

4. **Progress reporting** — after each chunk:
   ```
   Chunk 3/8 complete ✓
     Steps: 12/12
     Tests: 5947 passing (+27)
     Commits: 3 on feat/iter-5/agent-workspace-isolation
   ```

5. **Plan-level completion** — when all chunks are done, run the full quality suite:
   ```bash
   npx tsc --noEmit --project configs/tsconfig.json
   npx vitest run --config configs/vitest.config.ts
   npx eslint src/ --config configs/eslint.config.mjs
   node configs/esbuild.config.mjs
   ```

The skill follows TDD when the plan specifies it (most plans have "write failing tests" before "write implementation"). It does not impose TDD if the plan doesn't call for it — the plan is the authority.

### Step 4: PR Gate & Completion (human-driven)

After all chunks pass the full quality suite:

1. **Generate diff summary** — collect stats from the workspace branch:
   ```bash
   git log master..HEAD --oneline
   git diff master..HEAD --stat
   ```

2. **Present gate to user:**
   ```
   Plan execution complete
     Branch:  feat/iter-5/agent-workspace-isolation
     Commits: 10
     Files:   18 changed (+1,240 / -85)
     Tests:   5,985 passing (all green)
     TSC:     clean
     ESLint:  clean
     Build:   clean

   Ready to push and create PR?
   ```
   Wait for user confirmation.

3. **If confirmed — push and create PR:**
   ```bash
   git push -u origin feat/iter-5/agent-workspace-isolation
   gh pr create --title "feat(iter-5): <plan goal summary>" \
     --body "<generated body>"
   ```
   PR body structure:
   - **Summary** — plan goal + bullet list of chunks completed
   - **Changes** — key files created/modified. Source: plan's file structure table if present, otherwise derived from `git diff master..HEAD --stat`
   - **Quality** — test count, coverage, tsc, eslint, build status
   - **Plan** — link to the plan file
   - **Test Plan** — checklist from the plan's verification steps if present, otherwise a generic "all quality gates passed" summary

4. **If declined** — present options: keep branch for manual review, or go back and fix something.

5. **Collect workspace state:**
   ```bash
   flowti workspace:collect <workspace-id>
   ```
   Merges runtime state back to the vault and records the session.

6. **Report completion:**
   ```
   Done
     PR:        https://github.com/user/flowti/pull/42
     Workspace: retained (inspect with flowti workspace:inspect <id>)
     Branch:    feat/iter-5/agent-workspace-isolation
   ```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No spec found for plan | Stop: "No spec found — run brainstorming first" |
| No active iteration | Stop: "No active iteration — run iteration-planning first" |
| Workspace already active for this plan | Stop: "Workspace already running for this plan" |
| Workspace retained from previous run | Ask: "Resume existing workspace or start fresh?" |
| Dirty vault root | Warn + ask: "Uncommitted changes detected. Proceed or stash first?" |
| Baseline tests fail in workspace | Stop: "Baseline broken — fix before executing plan" |
| Chunk tests fail, fix succeeds | Continue after fix |
| Chunk tests fail, fix fails 2x | Stop: "Chunk N broke tests — need guidance" |
| Full suite fails after all chunks | Stop: "Final verification failed — review before PR" |
| PR creation fails (no `gh` CLI) | Show push command, provide PR body for manual creation |
| Workspace provisioning fails | Surface `workspace:error` details, suggest checking config |

---

## Integration Points

### Skills Referenced

| Skill | Relationship |
|-------|-------------|
| `product-management:_foundation` | Read at startup for project root, CLI commands, artifact patterns |
| `superpowers:brainstorming` | Pre-flight nudges toward this if no spec exists |
| `superpowers:writing-plans` | Pre-flight nudges toward this if no plan exists |
| `product-management:iteration-planning` | Pre-flight requires an active iteration |

### Flowti CLI Commands Used

| Command | Phase | Purpose |
|---------|-------|---------|
| `flowti workspace:collect` | Completion | Merge state back to vault |
| `flowti workspace:inspect` | Completion | Show workspace details |

### Shell Commands Used

| Command | Phase | Purpose |
|---------|-------|---------|
| `git worktree add` | Provisioning | Create isolated workspace (worktree method) |
| `git clone` | Provisioning | Create isolated workspace (clone fallback) |
| `npm install` | Provisioning | Install dependencies in workspace |
| `npx vitest run` | Execution, Verification | Run tests |
| `npx tsc --noEmit` | Execution, Verification | Type check |
| `npx eslint src/` | Verification | Lint check |
| `node configs/esbuild.config.mjs` | Verification | Build check |
| `git add` / `git commit` | Execution | Commit chunk work |
| `git push -u origin` | PR creation | Push feature branch |
| `gh pr create` | PR creation | Open pull request (pre-flight checks `gh --version`; if missing, outputs push command + PR body for manual creation) |

### Agent Skill Map Integration

Add to `.flowti/config.json` → `agents.skillMap`:

- **engineering** domain: `product-management:execute-in-workspace`
- **management** domain: `product-management:execute-in-workspace`
- **orchestration** domain: `product-management:execute-in-workspace`

---

## Future: Multi-Agent Execution

Not implemented in v1. The design leaves room for expansion:

- The skill executes as the current Claude Code session today (no separate agent identity needed). A future v2 could accept `--parallel` which would:
  - Parse plan chunks for independence (no cross-chunk file dependencies)
  - Provision separate workspaces per chunk: `ws-agent-A-chunk-1`, `ws-agent-B-chunk-2`
  - Each agent works on its own branch: `feat/iter-N/plan-slug/chunk-1`, `feat/iter-N/plan-slug/chunk-2`
  - A coordination step merges chunk branches into the main feature branch before the PR gate

- The workspace registry already supports `maxConcurrent: 5` and tracks multiple workspaces
- `IAgentShell.dispatch()` already takes an agent slug — dispatching to different agents is a parameter change, not an architecture change
- The PR step would need to handle merge conflicts between chunk branches — likely by rebasing sequentially in dependency order

No code or interface changes needed for v1. This section documents the expansion path so v1 decisions don't block it.

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Flowti-native, replaces superpowers execution combo | Full control over workspace lifecycle, iteration awareness |
| Focus | Execution-only with pre-flight validation | Single responsibility — brainstorm/spec/plan remain separate |
| Branch naming | `feat/iter-{N}/{plan-slug}` | Full traceability to iteration + feature |
| PR flow | Gate before push | Human confirms, prevents pushing incomplete work |
| Agent model | Single-agent v1 | Prove the flow first, multi-agent designed for but deferred |
| Namespace | `product-management:` | Part of iteration lifecycle, not a workspace utility |
| Pattern | Thin orchestrator via CLI commands | Consistent with ceremony skills, stable interface |

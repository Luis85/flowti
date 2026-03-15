---
name: execute-in-workspace
description: Execute an implementation plan in an isolated agent workspace — provisions a feature branch, runs plan steps, verifies quality gates, and creates a PR when green
user-invocable: true
---

# Execute in Workspace

Execute an implementation plan in an isolated agent workspace. Provisions a feature branch, runs plan steps with quality gates after each chunk, and creates a PR when everything is green.

**Iteration status context:** During `in-progress` phase.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

## Workflow

### Step 1: Pre-Flight Checks (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
2. **Resolve plan** — if `$ARGUMENTS` is a path, use it. Otherwise glob `<project>/docs/plans/*.md` and pick the most recent by filename date prefix
3. **Verify spec exists** — extract the `Spec:` line from the plan header, confirm the referenced spec file exists. If missing: stop with "No spec found — run brainstorming first."
4. **Verify iteration context** — read iteration plans from `<project>/iterations/iteration-*-plan.md`, find the one with `status: in-progress`. If none: stop with "No active iteration — run iteration-planning first."
5. **Check for existing workspace** — read `.flowti/var/workspace-registry.json` (if exists), search for an entry whose `branch` matches `feat/iter-{N}/{plan-slug}`:
   - If found and `state: active`: stop with "Workspace already running for this plan."
   - If found and `state: retained`: ask "Resume existing workspace or start fresh?"
6. **Verify clean vault** — run `git status` at the vault root. If dirty: warn "Uncommitted changes detected" and ask whether to proceed or stash first

If all checks pass, display a summary and wait for confirmation:

```
Pre-flight ✓
  Plan:      <plan-filename> (<N> chunks, <M> files)
  Spec:      <spec-filename>
  Iteration: #<N> "<name>" (in-progress)
  Branch:    feat/iter-<N>/<plan-slug>
  Workspace: ws-plan-<slug-8>-<hex>
  Dev branch: <current-branch>

Proceed with workspace provisioning?
```

### Step 2: Workspace Provisioning (automated)

1. **Derive identifiers:**
   - Branch: `feat/iter-{N}/{plan-slug}` — `N` from active iteration, `plan-slug` from filename with date prefix stripped
   - Workspace ID: `ws-plan-{plan-slug-first-8-chars}-{4-char-hex}`
   - `baseDir` from `.flowti/config.json` → `workspaces.baseDir` (default: `../flowti-agents` relative to vault root)

2. **Provision workspace** using git commands directly:
   ```bash
   # From vault root — worktree (default)
   git worktree add "<baseDir>/<workspace-id>" -b feat/iter-N/plan-slug master
   ```
   If the branch already exists (resuming), use clone fallback:
   ```bash
   git clone . "<baseDir>/<workspace-id>"
   cd "<baseDir>/<workspace-id>"
   git checkout -b feat/iter-N/plan-slug
   ```

3. **Register in workspace registry** — read `.flowti/var/workspace-registry.json` from vault root (create if missing), append entry:
   ```json
   {
     "id": "<workspace-id>",
     "agentSlug": "plan-executor",
     "branch": "feat/iter-N/plan-slug",
     "baseBranch": "master",
     "method": "worktree",
     "state": "active",
     "path": "<absolute workspace path>",
     "retain": true,
     "createdAt": "<ISO 8601 now>"
   }
   ```

4. **Install dependencies** — run `npm install` inside `<workspace>/<project>/` (e.g., `<workspace>/01 - Projects/Flowti CLI/`)

5. **Verify clean baseline** — from the workspace project dir, run:
   ```bash
   npx tsc --noEmit --project configs/tsconfig.json
   npx vitest run --config configs/vitest.config.ts
   npx eslint src/ --config configs/eslint.config.mjs
   ```
   If any fail: stop and report "Baseline broken — fix before executing plan"

6. **Report ready** and begin execution:
   ```
   Workspace ready
     Path:   <absolute workspace path>
     Branch: feat/iter-<N>/<plan-slug>
     Base:   master
     Tests:  <count> passing, 0 failures

   Starting plan execution...
   ```

**All subsequent work happens inside the workspace directory. The vault root is untouched until Step 4.**

### Step 3: Plan Execution (automated)

1. **Parse plan structure** — read the plan file, identify chunks/tasks by `## Chunk` or `### Task` headers. Count total steps (`- [ ]` checkboxes)

2. **For each chunk, sequentially:**
   - Display chunk header and step count
   - Execute each step following the plan's instructions exactly (create files, modify files, run commands)
   - After each step, mark its checkbox `- [x]` in the plan file within the workspace
   - Commit after each completed chunk:
     ```bash
     git add <changed files>
     git commit -m "feat(iter-N): <chunk summary>"
     ```

3. **Quality gate after each chunk** — run:
   ```bash
   npx vitest run --config configs/vitest.config.ts
   npx tsc --noEmit --project configs/tsconfig.json
   ```
   - If green: continue to next chunk
   - If red: stop, display failures, attempt to fix. If fix fails after 2 attempts: stop and ask "Chunk N broke tests — need guidance"

4. **Progress reporting** — after each chunk:
   ```
   Chunk <M>/<total> complete ✓
     Steps: <done>/<total>
     Tests: <count> passing (+<delta>)
     Commits: <N> on feat/iter-<N>/<plan-slug>
   ```

5. **Plan-level completion** — when all chunks are done, run the full quality suite:
   ```bash
   npx tsc --noEmit --project configs/tsconfig.json
   npx vitest run --config configs/vitest.config.ts
   npx eslint src/ --config configs/eslint.config.mjs
   node configs/esbuild.config.mjs
   ```

The plan is the authority. Follow TDD when the plan specifies it. Do not impose TDD if the plan doesn't call for it.

### Step 4: Merge Gate & Completion (human-driven)

After all chunks pass the full quality suite:

1. **Generate diff summary** (from workspace):
   ```bash
   git log master..HEAD --oneline
   git diff master..HEAD --stat
   ```

2. **Present gate to user:**
   ```
   Plan execution complete
     Branch:  feat/iter-<N>/<plan-slug>
     Commits: <count>
     Files:   <count> changed (+<added> / -<removed>)
     Tests:   <count> passing (all green)
     TSC:     clean
     ESLint:  clean
     Build:   clean

   How would you like to integrate this work?
     1. Merge into current dev branch (<current-branch>)
     2. Merge into master
     3. Keep the workspace branch as-is (handle later)
     4. Discard this work
   ```
   Wait for user choice.

3. **Option 1 — Merge into dev branch** (default):
   ```bash
   # From vault root
   git merge feat/iter-N/plan-slug --no-ff -m "feat(iter-N): <plan goal summary>"
   ```
   Then run tests in the vault to verify the merge is clean:
   ```bash
   cd "<project>" && npx vitest run --config configs/vitest.config.ts && npx tsc --noEmit --project configs/tsconfig.json
   ```
   If tests pass: report success. If merge conflicts: present them and help resolve.

4. **Option 2 — Merge into master:**
   ```bash
   git checkout master
   git merge feat/iter-N/plan-slug --no-ff -m "feat(iter-N): <plan goal summary>"
   ```
   Verify tests, then ask whether to switch back to the previous branch.

5. **Option 3 — Keep as-is:**
   Report workspace path and branch name. No merge, no cleanup.

6. **Option 4 — Discard:**
   Confirm with user first: "This will delete branch feat/iter-N/plan-slug and all commits. Type 'discard' to confirm."
   If confirmed: remove worktree and delete branch.

7. **Cleanup workspace** (for options 1, 2, 4):
   ```bash
   git worktree remove "<workspace-path>"
   ```
   Update `.flowti/var/workspace-registry.json` — set workspace state to `disposed`.

8. **Report completion:**
   ```
   Done
     Merged:    feat/iter-<N>/<plan-slug> → <target-branch>
     Tests:     <count> passing
     Workspace: disposed
   ```

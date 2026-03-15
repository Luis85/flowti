---
name: finish-workspace
description: Finish an active workspace — merge work back to dev vault, clean up worktree, update registry, close out the branch
user-invocable: true
---

# Finish Workspace

Close out a workspace created by `execute-in-workspace`. Merges work back into the dev vault, cleans up the worktree, updates the workspace registry, and marks plan deliverables done.

**Iteration status context:** During `in-progress` phase.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

## Workflow

### Step 1: Pre-Flight Checks (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
2. **Resolve workspace** — read `.flowti/var/workspace-registry.json`:
   - If `$ARGUMENTS` is a workspace ID, find that entry
   - Else find the single entry with `state: active`
   - If zero active: stop with "No active workspace found. Use `$ARGUMENTS` to specify a workspace ID."
   - If multiple active: list them with ID, branch, path — ask which one
3. **Extract workspace metadata**: `id`, `branch`, `baseBranch`, `path`, `method`
4. **Verify workspace exists** — check the path exists on disk. If not: update registry to `state: disposed` and stop with "Workspace path no longer exists — marked as disposed."
5. **Run quality gates** — from `<workspace-path>/<project-source>/`:
   ```bash
   npm test
   ```
   If tests fail: stop with "Tests failing in workspace — fix before finishing."
6. **Gather stats**:
   ```bash
   git log <baseBranch>..<branch> --oneline
   git diff <baseBranch>..<branch> --stat
   ```

Display summary and wait for confirmation:

```
Workspace: <id>
Branch:    <branch> (based on <baseBranch>)
Path:      <absolute path>
Commits:   <N>
Files:     <N> changed (+<added> / -<removed>)
Tests:     <count> passing

Ready to finish.
```

### Step 2: Present Options

```
What would you like to do?

1. Merge back to <baseBranch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

Wait for user choice.

### Step 3: Execute Choice

#### Option 1: Merge Locally

1. **Check vault cleanliness** — run `git status` at vault root. If dirty: warn and ask whether to proceed or stash first.
2. **Checkout base branch** in the main vault (NOT the worktree):
   ```bash
   cd <vault-root>
   git checkout <baseBranch>
   ```
3. **Merge feature branch**:
   ```bash
   git merge <branch> --no-edit
   ```
   - If merge conflicts: stop, report conflicts, tell user to resolve manually. Do NOT auto-resolve or clean up.
4. **Verify tests on merged result** from the main vault project dir:
   ```bash
   cd <vault-root>/<project-source>
   npm test
   ```
   - If tests fail: stop, report failures. Do NOT clean up — user must fix.
5. If tests pass → proceed to Step 4 (cleanup)
   - Remove worktree: `git worktree remove <workspace-path>`
   - Delete feature branch: `git branch -d <branch>`
   - Update registry: `state: disposed`, `retain: false`, `completedAt: <ISO 8601 now>`

#### Option 2: Push and Create PR

1. **Push branch** from the worktree:
   ```bash
   cd <workspace-path>
   git push -u origin <branch>
   ```
2. **Create PR** (if `gh` available):
   ```bash
   gh pr create --title "<plan goal or last commit summary>" --body "$(cat <<'EOF'
   ## Summary
   <bullet list of chunks/commits>

   ## Quality
   - Tests: <count> passing
   - TSC: clean
   - ESLint: clean

   ## Changes
   <git diff --stat summary>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```
   If `gh` not available: output push command and PR body for manual creation.
3. **Update registry**: `state: retained`, add `pr: <PR URL>` if available
4. Report PR URL. Do NOT remove worktree (kept for review).

#### Option 3: Keep As-Is

1. Report: "Keeping workspace `<id>` at `<path>`. Branch `<branch>` preserved."
2. Do NOT change registry state or clean up anything.
3. Done.

#### Option 4: Discard

1. **Confirm**: display all commits that will be lost:
   ```
   This will permanently delete:
   - Branch <branch>
   - <N> commits:
     <commit list>
   - Worktree at <path>

   Type 'discard' to confirm.
   ```
2. Wait for exact typed confirmation. If anything else: abort.
3. If confirmed:
   ```bash
   cd <vault-root>
   git worktree remove <workspace-path>
   git branch -D <branch>
   ```
4. Update registry: `state: disposed`, `retain: false`, `completedAt: <ISO 8601 now>`

### Step 4: Mark Plan Deliverables (Options 1 and 2 only)

1. **Derive plan file** — from the workspace branch slug: `feat/iter-N/<plan-slug>` → look for `<project>/docs/plans/*-<plan-slug>.md`
2. If plan file found, locate the `## Deliverables Checklist` section
3. Replace all `- [ ]` with `- [x]` in that section only
4. Commit: `chore: mark PA3 deliverables complete` (adjust name to match plan)

### Step 5: Report

```
Workspace finished ✓
  Action:    <merged locally | PR created | kept | discarded>
  Branch:    <branch> → <baseBranch> (merged/deleted/kept)
  Worktree:  <removed | retained at path>
  Registry:  <updated to disposed | unchanged>
  PR:        <URL> (if Option 2)
```

# Finish Workspace — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Flowti Product Management skill — close out a workspace created by `execute-in-workspace`

## Problem Statement

`execute-in-workspace` provisions an isolated git worktree, executes a plan, and leaves the workspace in `active` state. There is no structured workflow to merge work back into the dev vault, clean up the worktree, update the workspace registry, and close out the plan. Today this is done manually with ad-hoc git commands.

## Solution

A `finish-workspace` skill that reads the workspace registry, verifies quality gates, presents merge options, executes the chosen strategy, cleans up artifacts, and updates tracking state.

## Workflow

### Step 1: Pre-Flight (automated)

1. Resolve project root from `.flowti/config.json` → `source`
2. Read `.flowti/var/workspace-registry.json`, find workspace:
   - If `$ARGUMENTS` is a workspace ID, use it
   - Else find the single `state: active` entry
   - If zero active: stop with "No active workspace found"
   - If multiple active: list them and ask which one
3. Read the workspace entry: `id`, `branch`, `baseBranch`, `path`, `method`
4. Verify the workspace path exists on disk
5. Run the project's test suite from the workspace project dir (`npm test`)
   - If tests fail: stop with "Tests failing — fix before finishing"
6. Gather stats: `git log <baseBranch>..<branch> --oneline` for commit count, `git diff <baseBranch>..<branch> --stat` for file changes

Display summary:
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
```

### Step 3: Execute Choice

#### Option 1: Merge Locally

1. Switch to the base branch in the **main vault** (not the worktree):
   ```bash
   cd <vault-root>
   git checkout <baseBranch>
   ```
2. Merge the feature branch:
   ```bash
   git merge <branch> --no-edit
   ```
3. Run the project's test suite from the **main vault** project dir to verify the merge:
   ```bash
   cd <vault-root>/<project-source>
   npm test
   ```
   - If tests fail: stop, report failures, do NOT clean up (user must fix)
4. If tests pass → proceed to Step 4 (cleanup)

#### Option 2: Push and Create PR

1. From the worktree, push the branch:
   ```bash
   cd <workspace-path>
   git push -u origin <branch>
   ```
2. Create PR with `gh pr create` (if `gh` available):
   - Title: last chunk's commit summary or plan goal
   - Body: commit list + file stats + test count
3. If `gh` unavailable: output the push command and PR body for manual creation
4. Proceed to Step 4 (cleanup) — but keep worktree retained

#### Option 3: Keep As-Is

1. Report: "Keeping workspace `<id>` at `<path>`. Branch `<branch>` preserved."
2. Do NOT clean up worktree or update registry state
3. Done

#### Option 4: Discard

1. Confirm: list all commits that will be lost, require typed "discard" confirmation
2. If confirmed:
   ```bash
   cd <vault-root>
   git worktree remove <workspace-path>
   git branch -D <branch>
   ```
3. Update registry → `state: disposed`, `retain: false`
4. Done

### Step 4: Cleanup (Options 1, 2, 4)

1. **Remove worktree** (Options 1 and 4 only; Option 2 retains):
   ```bash
   cd <vault-root>
   git worktree remove <workspace-path>
   ```
2. **Delete feature branch** (Option 1 only — merged; Option 4 — discarded):
   ```bash
   git branch -d <branch>    # -d for merged, -D for discarded
   ```
3. **Update workspace registry** — set `state: disposed`, `retain: false`, add `completedAt: <ISO 8601 now>`
4. **Mark plan checkboxes** — if the workspace entry has a traceable plan file (derive from branch slug → plan filename), update all `- [ ]` to `- [x]` in the plan's deliverables checklist

### Step 5: Report

```
Workspace finished ✓
  Action:    <merged | PR created | kept | discarded>
  Branch:    <branch> → <baseBranch> (or kept/deleted)
  Worktree:  <removed | retained>
  Registry:  <updated | unchanged>
  PR:        <URL> (if Option 2)
```

## Edge Cases

- **Worktree path doesn't exist** — already cleaned up externally. Update registry to `disposed` and report.
- **Branch already merged** — `git branch -d` succeeds. Normal flow.
- **Merge conflicts** — stop, report conflicts, tell user to resolve manually. Do not auto-resolve.
- **No `gh` CLI** — Option 2 falls back to manual instructions (push command + PR body text).
- **Dirty vault** — warn before merge (Option 1). Suggest stash or commit first.

## Non-Goals

- Does not update iteration plan scope items (that's increment-review's job)
- Does not generate reports or cycle notes
- Does not handle multi-workspace orchestration (one at a time)

## Integration

- **Called after:** `execute-in-workspace` completes all chunks
- **Reads:** `.flowti/var/workspace-registry.json`, plan files
- **Writes:** workspace registry (state update), plan file (checkbox marks)
- **Uses foundation:** project root resolution from `_foundation.md`

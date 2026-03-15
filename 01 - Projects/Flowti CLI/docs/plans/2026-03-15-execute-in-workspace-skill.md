# Execute-in-Workspace Skill — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `product-management:execute-in-workspace` Claude Code skill and integrate it into the agent skill map, so plan execution happens in isolated workspaces with feature-branch discipline and PR gates.

**Architecture:** A markdown skill file in `.claude/commands/product-management/` following the ceremony skill pattern (frontmatter, foundation reference, numbered steps with automated/human-driven labels). Config updates to `.flowti/config.json` for skill map. Fix stale foundation path references in existing ceremony skills.

**Tech Stack:** Markdown (skill files), JSON (config)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-execute-in-workspace-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `.claude/commands/product-management/execute-in-workspace.md` | The skill — full workflow from pre-flight to PR |
| MODIFY | `.flowti/config.json` | Add skill to engineering, management, orchestration skill maps |
| MODIFY | `.claude/commands/product-management/backlog-refinement.md` | Fix foundation path |
| MODIFY | `.claude/commands/product-management/iteration-planning.md` | Fix foundation path |
| MODIFY | `.claude/commands/product-management/increment-review.md` | Fix foundation path |
| MODIFY | `.claude/commands/product-management/retrospective.md` | Fix foundation path |
| MODIFY | `.claude/commands/product-management/three-amigos-review.md` | Fix foundation path |
| MODIFY | `.claude/commands/product-management/feature-document.md` | Fix foundation path |

---

## Chunk 1: Fix Foundation Path in Existing Skills

The 6 existing ceremony skills reference `.claude/skills/product-management/_foundation.md` which no longer exists (moved to `.claude/commands/`). Fix all references.

### Task 1: Update foundation path in all ceremony skills

**Files:**
- Modify: `.claude/commands/product-management/backlog-refinement.md:16`
- Modify: `.claude/commands/product-management/iteration-planning.md:16`
- Modify: `.claude/commands/product-management/increment-review.md:16`
- Modify: `.claude/commands/product-management/retrospective.md:16`
- Modify: `.claude/commands/product-management/three-amigos-review.md:16`
- Modify: `.claude/commands/product-management/feature-document.md:16`

- [ ] **Step 1: Replace old path with new path in all 6 files**

In each file, replace:
```
- Read `.claude/skills/product-management/_foundation.md`
```
With:
```
- Read `.claude/commands/product-management/_foundation.md`
```

- [ ] **Step 2: Verify no stale references remain**

Search for `.claude/skills/product-management` across all `.claude/commands/` files. Expect 0 results.

- [ ] **Step 3: Commit**

```bash
git add ".claude/commands/product-management/"
git commit -m "fix: update foundation path in ceremony skills to .claude/commands/"
```

---

## Chunk 2: Create the Skill File

### Task 2: Write execute-in-workspace.md

**Files:**
- Create: `.claude/commands/product-management/execute-in-workspace.md`

- [ ] **Step 1: Create the skill file**

Create `.claude/commands/product-management/execute-in-workspace.md` with this content:

```markdown
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
7. **Check `gh` CLI** — run `gh --version`. If missing: note that PR creation will require manual steps (warning, not a blocker)

If all checks pass, display a summary and wait for confirmation:

```
Pre-flight ✓
  Plan:      <plan-filename> (<N> chunks, <M> files)
  Spec:      <spec-filename>
  Iteration: #<N> "<name>" (in-progress)
  Branch:    feat/iter-<N>/<plan-slug>
  Workspace: ws-plan-<slug-8>-<hex>
  gh CLI:    available | not found (manual PR)

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

### Step 4: PR Gate & Completion (human-driven)

After all chunks pass the full quality suite:

1. **Generate diff summary:**
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

   Ready to push and create PR?
   ```
   Wait for user confirmation.

3. **If confirmed — push and create PR:**
   ```bash
   git push -u origin feat/iter-N/plan-slug
   ```
   Then create PR with `gh pr create`:
   - **Title:** `feat(iter-N): <plan goal summary>`
   - **Summary:** plan goal + bullet list of chunks completed
   - **Changes:** key files from plan's file structure table, or from `git diff master..HEAD --stat` if no table
   - **Quality:** test count, tsc, eslint, build status
   - **Plan:** link to the plan file
   - **Test Plan:** verification steps from plan, or "all quality gates passed" if none specified

   If `gh` is not available: output the `git push` command and PR body text for manual creation.

4. **If declined** — present options: keep branch for manual review, or go back and fix something.

5. **Collect workspace state** (back in vault root):
   ```bash
   flowti workspace:collect <workspace-id>
   ```

6. **Report completion:**
   ```
   Done
     PR:        <PR URL>
     Workspace: retained (flowti workspace:inspect <id>)
     Branch:    feat/iter-<N>/<plan-slug>
   ```
```

- [ ] **Step 2: Verify the skill file is well-formed**

Check that the file:
- Has valid YAML frontmatter with `name`, `description`, `user-invocable: true`
- References `_foundation.md` in "Before You Start"
- Uses Step N naming with `(automated)` / `(human-driven)` labels
- All placeholders use `<>` angle bracket format consistently

- [ ] **Step 3: Commit**

```bash
git add ".claude/commands/product-management/execute-in-workspace.md"
git commit -m "feat: add execute-in-workspace skill for isolated plan execution"
```

---

## Chunk 3: Skill Map Integration

### Task 3: Update agent skill map in config

**Files:**
- Modify: `.flowti/config.json`

- [ ] **Step 1: Add skill to engineering, management, and orchestration domains**

In `.flowti/config.json` → `agents.skillMap`, add `"product-management:execute-in-workspace"` to:

- `engineering` array (after `superpowers:verification-before-completion`)
- `management` array (after `product-management:retrospective`)
- `orchestration` array (after `superpowers:executing-plans`)

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('.flowti/config.json','utf8')); console.log('valid')"
```

- [ ] **Step 3: Commit**

```bash
git add ".flowti/config.json"
git commit -m "feat: add execute-in-workspace to agent skill map (engineering, management, orchestration)"
```

---

## Chunk 4: Verification

### Task 4: End-to-end verification

- [ ] **Step 1: Verify skill appears in Claude Code**

Check the system-reminder skill list for `product-management:execute-in-workspace`. It should appear alongside the other 7 product-management skills.

- [ ] **Step 2: Verify all ceremony skills reference correct foundation path**

```bash
grep -r "\.claude/skills/product-management" .claude/commands/
```

Expected: 0 results (all should reference `.claude/commands/product-management/` now).

- [ ] **Step 3: Verify skill map config is valid**

```bash
node -e "const c=JSON.parse(require('fs').readFileSync('.flowti/config.json','utf8')); const sm=c.agents.skillMap; console.log('eng:', sm.engineering.includes('product-management:execute-in-workspace')); console.log('mgmt:', sm.management.includes('product-management:execute-in-workspace')); console.log('orch:', sm.orchestration.includes('product-management:execute-in-workspace'))"
```

Expected: all `true`.

- [ ] **Step 4: Count total product-management skills**

```bash
ls .claude/commands/product-management/*.md | grep -v _foundation | wc -l
```

Expected: 7 (backlog-refinement, iteration-planning, increment-review, retrospective, three-amigos-review, feature-document, execute-in-workspace).

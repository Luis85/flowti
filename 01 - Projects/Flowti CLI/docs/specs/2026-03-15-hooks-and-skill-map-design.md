# Hooks & Skill Map Design

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Claude Code hooks configuration + domain-mapped skill injection for Flowti agents

## Problem

1. No protective hooks exist — edits to sensitive files (.env, lock files) are unguarded, and lint/typecheck errors are caught late.
2. Agent system prompts and briefs have no awareness of installed Claude Code skills (superpowers, feature-dev, etc.). When agents are spawned via `claude --print`, they cannot leverage TDD, debugging, brainstorming, or other structured workflows.

## Decision

Implement both:
- **Hooks**: Full protection — block sensitive file edits, auto-lint, auto-typecheck on every `.ts` edit.
- **Skill map**: Domain-mapped skill injection via `.flowti/config.json`. Both `claude:sync` (SKILL.md) and `brief-store` (brief generation) read the same map.

### Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hook scripts | Standalone `.claude/hooks/*.sh` | Readable, testable, maintainable vs inline commands |
| Skill mapping | Domain-based in config | "Config is the contract" principle; scales with roster; no per-agent maintenance |
| Skill style | Guidance, not directive | Agents choose when skills add value; avoids rigid workflows |
| Skill source | `.flowti/config.json` | Single source of truth for both sync and brief generation |

## Workstream 1: Hooks

### Scripts

Three scripts in `.claude/hooks/`, each reading tool input from stdin as JSON.

**Working directory**: Hooks execute from the git/vault root (`C:\Projects\flowti`). Scripts use `SCRIPT_DIR` for robustness.

**Error handling**: If stdin JSON parsing fails, `$FILE` is empty and `case` falls through (no match = no block). This is safe for PostToolUse (no-op) and PreToolUse (allows edit through on parse failure — fail-open, not fail-closed).

**Known gap**: Bash tool writes (e.g., `echo > .env`) are not blocked by PreToolUse Edit/Write matchers. Accepted risk — Bash commands are separately gated by the permissions allowlist.

#### `.claude/hooks/block-sensitive-files.sh` (PreToolUse)

Blocks edits to `.env*` files and lock files. Exits non-zero with message on stderr to block.

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  *.env|*.env.*) echo "BLOCKED: Cannot edit $FILE — contains secrets" >&2; exit 1;;
  *package-lock.json|*pnpm-lock.yaml) echo "BLOCKED: Cannot edit lock file $FILE" >&2; exit 1;;
esac
```

#### `.claude/hooks/auto-lint.sh` (PostToolUse)

Runs ESLint on the edited file if it's a `.ts` file inside CLI `src/`. Exit code from `eslint` is preserved (not piped through `tail`) so Claude sees failures.

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../../01 - Projects/Flowti CLI"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  */Flowti\ CLI/src/*.ts)
    cd "$PROJECT_DIR" && npx eslint --config configs/eslint.config.mjs "$FILE" 2>&1;;
esac
```

#### `.claude/hooks/auto-typecheck.sh` (PostToolUse)

Runs `tsc --noEmit` after any `.ts` edit in the CLI project.

**Performance note**: `tsc --noEmit` compiles the full project (~377 source files). Expect 5-15s per edit. This is a deliberate trade-off for early type error detection. If it becomes too slow, this hook can be removed in favor of periodic manual checks.

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../../01 - Projects/Flowti CLI"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  */Flowti\ CLI/src/*.ts|*/Flowti\ CLI/tests/*.ts)
    cd "$PROJECT_DIR" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | tail -10;;
esac
```

### Settings Configuration

`.claude/settings.json` gains a `hooks` section alongside existing `enabledPlugins`:

```json
{
  "enabledPlugins": { "...existing..." },
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/block-sensitive-files.sh" }]
    }],
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [
        { "type": "command", "command": "bash .claude/hooks/auto-lint.sh" },
        { "type": "command", "command": "bash .claude/hooks/auto-typecheck.sh" }
      ]
    }]
  }
}
```

## Workstream 2: Skill Map

### Config Schema

Add `skillMap` to existing `AgentsConfig` in `types-config.ts`:

```typescript
export interface AgentsConfig {
  dir?: string;
  roster?: string[];
  autonomous?: boolean;
  claudeSync?: boolean;
  skillMap?: Record<string, string[]>;  // domain → skill slugs
}
```

### Config Data

`.flowti/config.json` agents section:

```json
{
  "agents": {
    "dir": "03 - Resources/Agents",
    "claudeSync": true,
    "skillMap": {
      "engineering": [
        "superpowers:test-driven-development",
        "superpowers:systematic-debugging",
        "superpowers:requesting-code-review",
        "superpowers:verification-before-completion"
      ],
      "design": [
        "superpowers:brainstorming",
        "superpowers:writing-plans",
        "feature-dev:feature-dev"
      ],
      "product": [
        "superpowers:brainstorming",
        "superpowers:writing-plans"
      ],
      "management": [
        "superpowers:dispatching-parallel-agents",
        "superpowers:writing-plans",
        "superpowers:executing-plans"
      ],
      "quality": [
        "superpowers:requesting-code-review",
        "superpowers:verification-before-completion"
      ],
      "analysis": [
        "superpowers:brainstorming",
        "superpowers:writing-plans"
      ],
      "operations": [
        "superpowers:verification-before-completion",
        "superpowers:finishing-a-development-branch"
      ],
      "orchestration": [
        "superpowers:dispatching-parallel-agents",
        "superpowers:brainstorming",
        "superpowers:writing-plans",
        "superpowers:executing-plans"
      ]
    }
  }
}
```

### Injection Point 1: `claude-sync.ts`

`generateAgentSkillContent(agents, agentsDir, deps)` gains a new parameter:

```typescript
function generateAgentSkillContent(
  agents: AgentSummary[],
  agentsDir: string,
  deps: ClaudeSyncDeps,
  skillMap?: Record<string, string[]>  // NEW
): string
```

When generating per-agent detail sections, look up `skillMap?.[agent.domain]`. If found, append:

```markdown
**Recommended Skills**:
- `/superpowers:test-driven-development` — Use when implementing features
- `/superpowers:systematic-debugging` — Use when investigating failures
```

Callers pass `skillMap` from the vault config:
- `claude-sync.controller.ts`: reads `cliConfig.agents?.skillMap`, passes to `syncAgentsToClaude()`
- `extensibility-handlers.ts`: same pattern

Agents without a domain (e.g., Bob) or with a domain not in `skillMap` get no skill references — silent skip, no warning.

### Injection Point 2: `brief-store.ts`

`BriefContext` gains a new optional field:

```typescript
interface BriefContext {
  // ...existing fields...
  availableSkills?: readonly string[];  // NEW — resolved skill slugs for this agent
}
```

In `generateBrief()`, after the "Your Role" section, if `ctx.availableSkills` is non-empty, inject:

```markdown
## Available Skills

You have access to the following skills that can help with your work.
Use them when the task benefits from a structured approach:

- `/superpowers:test-driven-development` — Write tests before implementation
- `/superpowers:systematic-debugging` — Structured root-cause analysis
```

**Domain purity preserved**: `brief-store.ts` never reads config. Callers perform the lookup:

```
UI/Controller layer:
  1. Read cliConfig.agents?.skillMap
  2. Lookup skillMap[agent.domain] → string[]
  3. Pass as ctx.availableSkills to generateBrief()
```

Callers to update:
- `iteration-handlers.ts`: `generateIterationBrief()` and `writeFullBrief()`
- `agents-run-menu.ts`: `runAgentInteractive()`

### Skill Slug Format

- **Config stores**: `"superpowers:test-driven-development"` (no slash — data)
- **Rendered output**: `/superpowers:test-driven-development` (with slash — invocation format)
- Consistent in both SKILL.md and briefs

### Skill Descriptions

Descriptions are auto-generated from the skill slug: split on `:`, take the last segment, convert hyphens to spaces, capitalize. Example: `superpowers:test-driven-development` renders as "Test driven development". This keeps the config simple (slugs only) while providing readable output.

### Resolution Flow

```
UI/Controller layer (callers):
  → read cliConfig.agents?.skillMap
  → lookup skillMap[agent.domain] → string[] | undefined
  → pass resolved skills to domain functions

Domain layer (pure):
  generateBrief(ctx):
    → if ctx.availableSkills is non-empty: render "Available Skills" section
    → else: skip

  generateAgentSkillContent(agents, dir, deps, skillMap):
    → for each agent: if skillMap?.[agent.domain]: render "Recommended Skills"
    → else: skip
```

## Files

### Created
- `.claude/hooks/block-sensitive-files.sh`
- `.claude/hooks/auto-lint.sh`
- `.claude/hooks/auto-typecheck.sh`

### Modified
- `.claude/settings.json` — add `hooks` config
- `.flowti/config.json` — add `skillMap` under `agents`
- `01 - Projects/Flowti CLI/src/infrastructure/types-config.ts` — extend `AgentsConfig` with `skillMap`
- `01 - Projects/Flowti CLI/src/domain/claude-sync/claude-sync.ts` — accept `skillMap` param, inject into SKILL.md
- `01 - Projects/Flowti CLI/src/domain/agents/brief-store.ts` — accept `availableSkills` in `BriefContext`, inject into briefs
- `01 - Projects/Flowti CLI/src/controller/claude-sync.controller.ts` — pass `skillMap` from vault config
- `01 - Projects/Flowti CLI/src/ui/handlers/extensibility-handlers.ts` — pass `skillMap` from vault config
- `01 - Projects/Flowti CLI/src/ui/handlers/iteration-handlers.ts` — resolve `skillMap[domain]` → pass as `availableSkills`
- `01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts` — resolve `skillMap[domain]` → pass as `availableSkills`
- `01 - Projects/Flowti CLI/src/domain/project/config-validators-review.ts` — validate `skillMap` shape

### Not Changed
- Agent `.prompt.md` files — skills come from config, not hardcoded
- Agent `.json` files — no per-agent metadata needed
- Sitemap — no structural changes

## Testing

### `claude-sync.ts` tests
- Agent with matching domain → "Recommended Skills" section appears with correct slugs
- Agent with no domain → no skills section
- Agent with domain not in skillMap → no skills section
- Multiple agents with different domains → each gets correct skills
- `skillMap` is `undefined` → no skills sections
- `skillMap` present but empty `{}` → no skills sections
- Domain mapped but skills array empty `[]` → no skills section

### `brief-store.ts` tests
- `availableSkills` provided with entries → "Available Skills" section in output
- `availableSkills` is `undefined` → no skills section
- `availableSkills` is empty `[]` → no skills section
- Skills rendered with `/` prefix (invocation format)

### `config-validators-review.ts` tests
- `skillMap` is valid `Record<string, string[]>` → no warnings
- `skillMap` values contain empty strings → warning
- `skillMap` keys are empty strings → warning

### Callers (integration)
- `iteration-handlers.ts`: `writeFullBrief()` passes resolved skills from config
- `agents-run-menu.ts`: `runAgentInteractive()` passes resolved skills from config
- `claude-sync.controller.ts`: passes `skillMap` to sync function

### Hook scripts
- Manual verification (shell scripts outside test harness)
- Verify block-sensitive-files blocks `.env` edits (exit 1)
- Verify block-sensitive-files allows normal `.ts` edits (exit 0)
- Verify auto-lint runs on CLI `src/*.ts` files only
- Verify auto-typecheck runs on CLI `src/*.ts` and `tests/*.ts` files only

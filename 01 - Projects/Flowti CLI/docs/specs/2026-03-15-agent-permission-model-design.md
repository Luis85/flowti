# Agent Permission Model — Three-Tier Tool Approval

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Replace flat `allowedTools` list with a three-tier permission model (Ask / Auto-allow / Trust) using policy-based defaults and accumulated grants

## Problem

Agents currently have a flat `allowedTools` list — a tool is either available or not. There is no runtime approval flow, no distinction between safe read-only tools and destructive ones, and no way for a user to progressively trust an agent. Background workers that need a tool outside their list simply fail silently.

## Decision

### 1. Data Model

**Permission policy** — static default declared on agent definition, overridable at runtime:

```typescript
export type PermissionMode = "ask" | "auto-allow" | "trust";

export interface AgentPermissionPolicy {
	readonly mode: PermissionMode;
	readonly autoAllowTools?: readonly string[];
}
```

Default safe tools (fallback when no per-agent `autoAllowTools` specified):

```typescript
const DEFAULT_SAFE_TOOLS = ["Read", "Glob", "Grep", "LS", "WebSearch", "WebFetch"] as const;
```

**Permission grant** — dynamic, accumulated at runtime, persisted across sessions:

```typescript
export interface PermissionGrant {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;       // ISO timestamp
	readonly grantedBy: "user" | "policy";
}
```

**Permission check result:**

```typescript
export type PermissionVerdict = "allowed" | "denied" | "prompt-user" | "queued";
```

### 2. Resolution Order

Permissions resolve before every process spawn. Three sources combine in priority order:

1. **State file override** — `permissionOverride` mode in `data-{slug}.json` (user changed mode at runtime)
2. **Definition default** — `permissions` on `AgentAIConfig` in agent markdown frontmatter
3. **Fallback** — `{ mode: "ask", autoAllowTools: DEFAULT_SAFE_TOOLS }`

The resolved policy is a single `AgentPermissionPolicy`. If `autoAllowTools` is absent in the resolved policy, `DEFAULT_SAFE_TOOLS` is used as the auto-allow set. Grants accumulate separately — they are additive and never reset by mode changes.

Note: `AgentSummary` picks up the `permissions` field transitively through `ai?: AgentAIConfig` — no separate change needed to `AgentSummary`.

### 3. Permission Check Flow

The permission engine is a pure function with no I/O:

```
checkPermission(policy, grants, tool, foreground) → PermissionVerdict
```

Decision tree:

1. Mode is `trust` → **allowed** (skip everything)
2. Tool has an accumulated grant with `scope: "always"` → **allowed**
3. Mode is `auto-allow` AND tool is in `autoAllowTools` → **allowed** (record grant with `grantedBy: "policy"`)
4. Mode is `ask`:
   - Foreground (interactive session) → **prompt-user** (wait for y / n / always)
   - Background (worker process) → **queued** (see queued flow below)
5. Default → **denied**

**Queued permission flow** (background workers in ask mode):

When a background worker needs a tool that isn't pre-approved:
1. The worker transitions to `waiting` state
2. A `requesting-permission` action is emitted to world state with `{ tool, task }` data
3. A `pendingPermissions` entry is added to the agent's state file:
   ```typescript
   pendingPermissions?: readonly { tool: string; requestedAt: string; taskContext?: string }[];
   ```
4. The current process spawn is denied the tool — it completes without it
5. When the user visits the agent detail page, pending requests are shown
6. User approves (grant added) or denies (request cleared)
7. On next `send()` or `spawn()`, the granted tool is included in `--allowedTools`

### 4. Process Runner Integration

`allowedTools` and `permissions` are complementary:

- `allowedTools` restricts what tools are **available** to the LLM (capability boundary)
- `permissions` controls whether each available tool is **approved** at runtime (trust boundary)

The process runner builds the `--allowedTools` CLI flag from the resolved set:

1. Start with `agent.ai.allowedTools` (the full capability set)
2. **Trust mode** → pass all allowed tools unrestricted
3. **Auto-allow mode** → pass `autoAllowTools` (or `DEFAULT_SAFE_TOOLS` if absent) + accumulated `"always"` grants (intersection with allowed tools)
4. **Ask mode** → pass only accumulated `"always"` grants (intersection with allowed tools)

Each `send()` or `spawn()` re-evaluates the allowed set. Users grant tools interactively between process spawns — not mid-process.

### 5. State Persistence

**Agent definition** (`AgentAIConfig` in agent-types.ts):

```typescript
export interface AgentAIConfig {
	provider?: string;
	systemPrompt?: string;
	outputFormat?: "text" | "stream-json";
	allowedTools?: string[];
	permissions?: AgentPermissionPolicy;  // NEW
}
```

**Agent state file** (`data-{slug}.json` in `.flowti/var/`):

```json
{
	"name": "Bob",
	"status": "idle",
	"tasks": [],
	"permissionOverride": "trust",
	"grants": [
		{ "tool": "Edit", "scope": "always", "grantedAt": "2026-03-15T12:00:00Z", "grantedBy": "user" },
		{ "tool": "Bash", "scope": "once", "grantedAt": "2026-03-15T12:01:00Z", "grantedBy": "user" }
	]
}
```

The `permissionOverride` field is optional — when absent, the definition default applies.

**Clearing `once`-scoped grants:** After `proc.result` resolves in `worker-manager.ts`'s `processMessage()`, the worker manager calls `clearOnceGrants(deps, varDir, agentName)` — a function in `agent-state.ts` that removes all grants with `scope: "once"` from the state file. This ensures one-time grants are consumed after a single process spawn.

### 6. UI Surface

**Agent detail page** — shows current mode and grant summary:

```
  Bob [ai] — Helper
  Permission: auto-allow (3 tools pre-approved, 1 user grant)
```

New actions on the agent detail page:

- `p) Change permission mode` — cycles through ask / auto-allow / trust, writes `permissionOverride` to state file
- `g) Manage grants` — lists all `"always"` grants with revoke option, includes "clear all" action

**Queued permission requests** — shown on agent detail page when a background worker has pending requests. The user approves or denies from there. Approved grants are written to the state file and the worker's tool list is re-resolved on next spawn.

### 7. Files to Create / Modify

**New file:**

| File | Purpose |
|------|---------|
| `src/domain/agents/permission-engine.ts` | Pure function module: `resolvePermissionPolicy`, `resolveAllowedTools`, `checkPermission`, `DEFAULT_SAFE_TOOLS` |
| `tests/domain/agents/permission-engine.test.ts` | Tests for all resolution paths and edge cases |

**Modified files:**

| File | Change |
|------|--------|
| `src/domain/agents/agent-types.ts` | Add `permissions?: AgentPermissionPolicy` to `AgentAIConfig` |
| `src/domain/agents/agent-state.ts` | Add `permissionOverride?`, `grants[]`, `pendingPermissions[]` to state shape; add `clearOnceGrants()` function |
| `src/domain/agents/agent-process-runner.ts` | Call `resolveAllowedTools()` before spawning instead of using `allowedTools` directly |
| `src/domain/agents/worker-manager.ts` | Load grants from state on worker spawn; re-resolve tools after queued permission is granted |
| `src/domain/agents/world-state-types.ts` | Deprecate `PermissionEntry` — keep for backward compat but grants are now persisted per-agent in state files, not in `WorldState.permissions`. The `permissions` field on `WorldState` is no longer written to; permission state lives in `data-{slug}.json` |
| `configs/sitemap.json` | Add `onChangePermission` and `onManageGrants` actions to agent detail page |
| `src/ui/handlers/register-handlers.ts` | Register handlers for the two new actions |

### Conventions

- Permission engine is a pure domain module — no I/O, receives all data as arguments
- Tabs for indentation, `.js` extensions in imports
- `maxComplexity=10`, `maxLines=350`
- Tests mirror source path: `src/domain/agents/permission-engine.ts` → `tests/domain/agents/permission-engine.test.ts`

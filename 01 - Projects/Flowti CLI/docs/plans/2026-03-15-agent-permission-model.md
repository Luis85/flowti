# Agent Permission Model Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-tier permission model (ask / auto-allow / trust) for agent tool calls with accumulated grants, policy resolution, and UI for managing permissions.

**Architecture:** A pure domain module (`permission-engine.ts`) handles all policy resolution and permission checks. The process runner calls `resolveAllowedTools()` before spawning. The worker manager clears once-grants after completion. The UI adds mode switching and grant management to the agent detail page.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-agent-permission-model-design.md`

---

## File Structure

### New files (1 source + 1 test)

| File | Responsibility |
|------|---------------|
| `src/domain/agents/permission-engine.ts` | `DEFAULT_SAFE_TOOLS`, `resolvePermissionPolicy()`, `resolveAllowedTools()`, `checkPermission()` |
| `tests/domain/agents/permission-engine.test.ts` | Tests for all resolution paths and edge cases |

### Modified files (7 source)

| File | Change |
|------|--------|
| `src/domain/agents/agent-types.ts` | Add `permissions?: AgentPermissionPolicy` to `AgentAIConfig` |
| `src/domain/agents/agent-state.ts` | Add `permissionOverride?`, `grants[]`, `pendingPermissions[]` to `AgentState`; add `clearOnceGrants()` |
| `src/infrastructure/agent-process-runner.ts` | Import `resolveAllowedTools` and use it to build `--allowedTools` |
| `src/infrastructure/worker-manager.ts` | Load grants on spawn, call `clearOnceGrants` after proc.result |
| `configs/sitemap.json` | Add `onChangePermission` and `onManageGrants` actions to agent-detail page |
| `src/ui/handlers/extensibility-handlers.ts` | Register handlers for permission mode and grant management |
| `src/ui/displays/agents-display.ts` | Show permission mode + grant count in agent detail render |

---

## Chunk 1: Permission Engine + Types

### Task 1: Add permission types to agent-types.ts

**Files:**
- Modify: `src/domain/agents/agent-types.ts`

- [ ] **Step 1: Add PermissionMode and AgentPermissionPolicy types**

After the `AgentAIConfig` interface, these types will be used by it. Add before the `AgentAIConfig` interface:

```typescript
export type PermissionMode = "ask" | "auto-allow" | "trust";

export interface AgentPermissionPolicy {
	readonly mode: PermissionMode;
	readonly autoAllowTools?: readonly string[];
}
```

Then add to `AgentAIConfig`:

```typescript
	/** Permission model for tool calls. */
	permissions?: AgentPermissionPolicy;
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-types.ts"
git commit -m "feat: add PermissionMode and AgentPermissionPolicy to agent types"
```

### Task 2: Create permission-engine.ts with TDD

**Files:**
- Create: `src/domain/agents/permission-engine.ts`
- Create: `tests/domain/agents/permission-engine.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import {
	DEFAULT_SAFE_TOOLS,
	resolvePermissionPolicy,
	resolveAllowedTools,
	checkPermission,
} from "../../../src/domain/agents/permission-engine.js";
import type { AgentPermissionPolicy, PermissionMode } from "../../../src/domain/agents/agent-types.js";

interface PermissionGrant {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
	readonly grantedBy: "user" | "policy";
}

describe("DEFAULT_SAFE_TOOLS", () => {
	it("includes read-only tools", () => {
		expect(DEFAULT_SAFE_TOOLS).toContain("Read");
		expect(DEFAULT_SAFE_TOOLS).toContain("Glob");
		expect(DEFAULT_SAFE_TOOLS).toContain("Grep");
	});

	it("does not include write tools", () => {
		expect(DEFAULT_SAFE_TOOLS).not.toContain("Edit");
		expect(DEFAULT_SAFE_TOOLS).not.toContain("Write");
		expect(DEFAULT_SAFE_TOOLS).not.toContain("Bash");
	});
});

describe("resolvePermissionPolicy", () => {
	it("uses state override when present", () => {
		const definition: AgentPermissionPolicy = { mode: "ask" };
		const result = resolvePermissionPolicy(definition, "trust");
		expect(result.mode).toBe("trust");
	});

	it("falls back to definition when no override", () => {
		const definition: AgentPermissionPolicy = { mode: "auto-allow", autoAllowTools: ["Read"] };
		const result = resolvePermissionPolicy(definition, undefined);
		expect(result.mode).toBe("auto-allow");
		expect(result.autoAllowTools).toEqual(["Read"]);
	});

	it("falls back to ask + DEFAULT_SAFE_TOOLS when no definition", () => {
		const result = resolvePermissionPolicy(undefined, undefined);
		expect(result.mode).toBe("ask");
	});

	it("preserves autoAllowTools from definition when override only changes mode", () => {
		const definition: AgentPermissionPolicy = { mode: "ask", autoAllowTools: ["Read", "Edit"] };
		const result = resolvePermissionPolicy(definition, "auto-allow");
		expect(result.mode).toBe("auto-allow");
		expect(result.autoAllowTools).toEqual(["Read", "Edit"]);
	});
});

describe("resolveAllowedTools", () => {
	const policy = (mode: PermissionMode, tools?: string[]): AgentPermissionPolicy =>
		({ mode, autoAllowTools: tools });

	it("trust mode passes all available tools", () => {
		const result = resolveAllowedTools(policy("trust"), [], ["Read", "Edit", "Bash"]);
		expect(result).toEqual(["Read", "Edit", "Bash"]);
	});

	it("auto-allow passes safe tools + always grants", () => {
		const grants: PermissionGrant[] = [
			{ tool: "Edit", scope: "always", grantedAt: "", grantedBy: "user" },
		];
		const result = resolveAllowedTools(policy("auto-allow", ["Read", "Glob"]), grants, ["Read", "Glob", "Edit", "Bash"]);
		expect(result).toContain("Read");
		expect(result).toContain("Glob");
		expect(result).toContain("Edit");
		expect(result).not.toContain("Bash");
	});

	it("auto-allow uses DEFAULT_SAFE_TOOLS when autoAllowTools absent", () => {
		const result = resolveAllowedTools(policy("auto-allow"), [], ["Read", "Glob", "Edit"]);
		expect(result).toContain("Read");
		expect(result).toContain("Glob");
		expect(result).not.toContain("Edit");
	});

	it("ask mode passes only always grants", () => {
		const grants: PermissionGrant[] = [
			{ tool: "Read", scope: "always", grantedAt: "", grantedBy: "user" },
		];
		const result = resolveAllowedTools(policy("ask"), grants, ["Read", "Edit"]);
		expect(result).toEqual(["Read"]);
	});

	it("ask mode with no grants returns empty", () => {
		const result = resolveAllowedTools(policy("ask"), [], ["Read", "Edit"]);
		expect(result).toEqual([]);
	});

	it("intersects with available tools", () => {
		const grants: PermissionGrant[] = [
			{ tool: "Bash", scope: "always", grantedAt: "", grantedBy: "user" },
		];
		const result = resolveAllowedTools(policy("auto-allow", ["Read"]), grants, ["Read"]);
		expect(result).toEqual(["Read"]);
		expect(result).not.toContain("Bash");
	});

	it("once-scoped grants are included in resolved tools", () => {
		const grants: PermissionGrant[] = [
			{ tool: "Edit", scope: "once", grantedAt: "", grantedBy: "user" },
		];
		const result = resolveAllowedTools(policy("ask"), grants, ["Edit"]);
		expect(result).toEqual(["Edit"]);
	});
});

describe("checkPermission", () => {
	const policy = (mode: PermissionMode, tools?: string[]): AgentPermissionPolicy =>
		({ mode, autoAllowTools: tools });

	it("trust mode always allows", () => {
		expect(checkPermission(policy("trust"), [], "Bash", true)).toBe("allowed");
		expect(checkPermission(policy("trust"), [], "Bash", false)).toBe("allowed");
	});

	it("always grant allows regardless of mode", () => {
		const grants: PermissionGrant[] = [{ tool: "Edit", scope: "always", grantedAt: "", grantedBy: "user" }];
		expect(checkPermission(policy("ask"), grants, "Edit", true)).toBe("allowed");
	});

	it("auto-allow allows safe tools", () => {
		expect(checkPermission(policy("auto-allow", ["Read", "Glob"]), [], "Read", true)).toBe("allowed");
	});

	it("auto-allow prompts for non-safe tools in foreground", () => {
		expect(checkPermission(policy("auto-allow", ["Read"]), [], "Bash", true)).toBe("prompt-user");
	});

	it("auto-allow queues non-safe tools in background", () => {
		expect(checkPermission(policy("auto-allow", ["Read"]), [], "Bash", false)).toBe("queued");
	});

	it("ask mode prompts in foreground", () => {
		expect(checkPermission(policy("ask"), [], "Read", true)).toBe("prompt-user");
	});

	it("ask mode queues in background", () => {
		expect(checkPermission(policy("ask"), [], "Read", false)).toBe("queued");
	});

	it("uses DEFAULT_SAFE_TOOLS when autoAllowTools absent in auto-allow", () => {
		expect(checkPermission(policy("auto-allow"), [], "Read", true)).toBe("allowed");
		expect(checkPermission(policy("auto-allow"), [], "Edit", true)).toBe("prompt-user");
	});
});
```

- [ ] **Step 2: Implement permission-engine.ts**

```typescript
/**
 * permission-engine.ts — Pure permission logic for agent tool calls.
 *
 * No I/O. Receives all data as arguments, returns verdicts.
 */

import type { AgentPermissionPolicy, PermissionMode } from "./agent-types.js";

export interface PermissionGrant {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
	readonly grantedBy: "user" | "policy";
}

export type PermissionVerdict = "allowed" | "denied" | "prompt-user" | "queued";

export const DEFAULT_SAFE_TOOLS: readonly string[] = ["Read", "Glob", "Grep", "LS", "WebSearch", "WebFetch"];

export function resolvePermissionPolicy(
	definition: AgentPermissionPolicy | undefined,
	stateOverride: PermissionMode | undefined,
): AgentPermissionPolicy {
	const base = definition ?? { mode: "ask" as const };
	if (stateOverride) return { ...base, mode: stateOverride };
	return base;
}

function safeTools(policy: AgentPermissionPolicy): readonly string[] {
	return policy.autoAllowTools ?? DEFAULT_SAFE_TOOLS;
}

export function resolveAllowedTools(
	policy: AgentPermissionPolicy,
	grants: readonly PermissionGrant[],
	availableTools: readonly string[],
): string[] {
	const available = new Set(availableTools);
	if (policy.mode === "trust") return [...available];
	const allowed = new Set<string>();
	const grantedTools = grants.map((g) => g.tool);
	if (policy.mode === "auto-allow") {
		for (const tool of safeTools(policy)) { if (available.has(tool)) allowed.add(tool); }
	}
	for (const tool of grantedTools) { if (available.has(tool)) allowed.add(tool); }
	return [...allowed];
}

export function checkPermission(
	policy: AgentPermissionPolicy,
	grants: readonly PermissionGrant[],
	tool: string,
	foreground: boolean,
): PermissionVerdict {
	if (policy.mode === "trust") return "allowed";
	if (grants.some((g) => g.tool === tool && g.scope === "always")) return "allowed";
	if (policy.mode === "auto-allow" && safeTools(policy).includes(tool)) return "allowed";
	return foreground ? "prompt-user" : "queued";
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/permission-engine.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/permission-engine.ts" "01 - Projects/Flowti CLI/tests/domain/agents/permission-engine.test.ts"
git commit -m "feat: add permission engine with policy resolution and tool check"
```

---

## Chunk 2: State Persistence + Process Runner Integration

### Task 3: Add permission fields to agent-state.ts

**Files:**
- Modify: `src/domain/agents/agent-state.ts`

- [ ] **Step 1: Add types to AgentState**

Import the `PermissionGrant` type:

```typescript
import type { PermissionGrant } from "./permission-engine.js";
```

Add `PendingPermission` interface after the existing `AgentPendingQuestion`:

```typescript
export interface PendingPermission {
	readonly tool: string;
	readonly requestedAt: string;
	readonly taskContext?: string;
}
```

Extend `AgentState` with three new fields:

```typescript
export interface AgentState {
	// ... existing fields ...
	readonly permissionOverride?: import("./agent-types.js").PermissionMode;
	readonly grants: readonly PermissionGrant[];
	readonly pendingPermissions: readonly PendingPermission[];
}
```

- [ ] **Step 2: Update emptyState, readAgentState, writeAgentState**

Update `emptyState`:

```typescript
function emptyState(name: string): AgentState {
	return { name, status: "idle", tasks: [], briefs: [], grants: [], pendingPermissions: [] };
}
```

Update `readAgentState` to parse the new fields from the raw JSON:

```typescript
grants: Array.isArray((raw as Record<string, unknown>).grants) ? (raw as Record<string, unknown>).grants as PermissionGrant[] : [],
pendingPermissions: Array.isArray((raw as Record<string, unknown>).pendingPermissions) ? (raw as Record<string, unknown>).pendingPermissions as PendingPermission[] : [],
permissionOverride: (raw as Record<string, unknown>).permissionOverride as AgentState["permissionOverride"],
```

- [ ] **Step 3: Add clearOnceGrants function**

```typescript
/** Remove all once-scoped grants from state. Called after a process spawn completes. */
export function clearOnceGrants(state: AgentState): AgentState {
	const filtered = state.grants.filter((g) => g.scope !== "once");
	if (filtered.length === state.grants.length) return state;
	return { ...state, grants: filtered };
}
```

- [ ] **Step 4: Run existing agent-state tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-state.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-state.ts"
git commit -m "feat: add permission grants and overrides to agent state"
```

### Task 4: Integrate permission engine into process runner

**Files:**
- Modify: `src/infrastructure/agent-process-runner.ts`

- [ ] **Step 1: Import permission engine**

```typescript
import { resolvePermissionPolicy, resolveAllowedTools } from "../domain/agents/permission-engine.js";
import type { PermissionGrant } from "../domain/agents/permission-engine.js";
import type { PermissionMode } from "../domain/agents/agent-types.js";
```

- [ ] **Step 2: Update spawn() to accept grants and override**

Change the `IAgentProcessRunner` interface in `worker-types.ts` to pass permission context. Actually — the process runner should NOT own permission resolution (it's infrastructure, not domain). Instead, the **caller** (worker manager or UI menu) resolves the tool list and passes it to spawn.

Better approach: add an optional `resolvedTools` parameter to `spawn()`:

Update `worker-types.ts`:

```typescript
export interface IAgentProcessRunner {
	spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[]): AgentProcess;
}
```

Update `agent-process-runner.ts` spawn function:

```typescript
spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[]): AgentProcess {
	// ...
	const args = [...provider.args];
	const tools = resolvedTools ?? agent.ai?.allowedTools ?? [];
	if (tools.length > 0) {
		args.push("--allowedTools", tools.join(","));
	}
	// ...
```

This keeps the process runner as pure I/O with no domain logic.

- [ ] **Step 3: Run process runner tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-process-runner.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts" "01 - Projects/Flowti CLI/src/infrastructure/agent-process-runner.ts"
git commit -m "feat: process runner accepts resolved tools list for permission-aware spawning"
```

### Task 5: Wire permission resolution into worker manager

**Files:**
- Modify: `src/infrastructure/worker-manager.ts`

- [ ] **Step 1: Import permission engine and state functions**

```typescript
import { resolvePermissionPolicy, resolveAllowedTools } from "../domain/agents/permission-engine.js";
import { readAgentState, writeAgentState, clearOnceGrants } from "../domain/agents/agent-state.js";
```

- [ ] **Step 2: Resolve tools before spawn**

In `processMessage()`, before calling `processRunner.spawn()`:

```typescript
const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
const agentState = readAgentState(deps, varDir, worker.name);
const policy = resolvePermissionPolicy(worker.agent.ai?.permissions, agentState.permissionOverride);
const available = worker.agent.ai?.allowedTools ?? [];
const resolvedTools = resolveAllowedTools(policy, agentState.grants, available);
const proc = processRunner.spawn(worker.agent, prompt, resolvedTools);
```

- [ ] **Step 3: Clear once-grants after completion**

After `proc.result` resolves, clear once-grants:

```typescript
const freshState = readAgentState(deps, varDir, worker.name);
const cleared = clearOnceGrants(freshState);
if (cleared !== freshState) writeAgentState(deps, varDir, worker.name, cleared);
```

- [ ] **Step 4: Run worker manager tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts"
git commit -m "feat: worker manager resolves permissions before spawn, clears once-grants after"
```

---

## Chunk 3: UI Surface

### Task 6: Add permission actions to sitemap + handlers

**Files:**
- Modify: `configs/sitemap.json` — add actions to agent-detail page
- Modify: `src/ui/handlers/extensibility-handlers.ts` — register handlers
- Modify: `src/ui/displays/agents-display.ts` — show permission info

- [ ] **Step 1: Add actions to sitemap.json**

In the `agent-detail` page actions array, add:

```json
{ "name": "onChangePermission", "label": "Change Permission Mode", "type": "handler", "target": "agents:change-permission", "group": "permissions" },
{ "name": "onManageGrants", "label": "Manage Grants", "type": "handler", "target": "agents:manage-grants", "group": "permissions" }
```

- [ ] **Step 2: Add permission display to agents-display.ts**

Add a `renderPermissionInfo` function that shows the current mode and grant count. Called from the agent-detail view handler.

- [ ] **Step 3: Register handlers in extensibility-handlers.ts**

Register `agents:change-permission`:
- Show menu: ask / auto-allow / trust
- Write selected mode to `permissionOverride` in state file
- Log confirmation

Register `agents:manage-grants`:
- List always-scoped grants with revoke option
- Show pending permission requests with approve/deny
- Clear all option

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 5: Run type check and lint**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 6: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "feat: add permission mode and grant management UI to agent detail page"
```

### Task 7: Full verification

- [ ] **Step 1: Full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

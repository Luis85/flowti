# Provider-Agnostic UI Guards — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 7 hardcoded `claude --version` checks in the UI/TUI layers with registry-aware guards so any registered LLM provider (Claude, Cursor, Ollama) enables agent features.

**Architecture:** Add a pure domain helper `hasLLMProvider()` that queries the provider registry. Thread `providerRegistry` into the menu deps types that need it. Update display strings to be provider-agnostic. Also cover the TUI chat page.

**Tech Stack:** TypeScript, Vitest, existing `IProviderRegistry` from `src/domain/agents/llm-types.ts`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/domain/agents/llm-availability.ts` | Pure helper: `hasLLMProvider(registry?)` |
| Create | `tests/domain/agents/llm-availability.test.ts` | Tests for the helper |
| Modify | `src/ui/menus/agents-interact-menu.ts:15,141,315` | Add `providerRegistry` to `TalkDeps`, replace `claude --version` checks |
| Modify | `src/ui/menus/agents-run-menu.ts:8,41,80` | Add `providerRegistry` to `RunMenuDeps`, replace checks |
| Modify | `src/ui/menus/roster-task-menu.ts:23,68` | Add `providerRegistry` to `RosterTaskDeps`, replace check |
| Modify | `src/tui/pages/agents-chat-page.tsx:41` | Replace `claude --version` check with `hasLLMProvider` |
| Modify | `src/ui/displays/agent-run-display.ts:21` | Replace hardcoded `claude --print` with generic hint |
| Modify | `tests/ui/menus/agents-menu.test.ts:109,445,672` | Add `providerRegistry` to mock deps, update error message assertions |
| Modify | `tests/ui/menus/agents-run-menu.test.ts:46` | Add `providerRegistry` to mock deps |
| Modify | `tests/ui/menus/roster-task-menu.test.ts` | Add `providerRegistry` to mock deps |
| Modify | `tests/ui/displays/agent-run-display.test.ts:27` | Update assertion for new display text |

**Out of scope:** Removing the legacy spawn path in `agent-process-runner.ts` — that requires updating 17 test calls in `agent-process-runner.test.ts` plus the TUI entry point at `tui-entry.ts:35`. Tracked as a separate cleanup task.

---

## Chunk 1: Domain Helper + Tests

### Task 1: Write `hasLLMProvider` helper — failing test

**Files:**
- Create: `tests/domain/agents/llm-availability.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { hasLLMProvider } from "../../../src/domain/agents/llm-availability.js";
import type { IProviderRegistry, ILLMProvider, ProviderCapabilities } from "../../../src/domain/agents/llm-types.js";

function mockProvider(name: string): ILLMProvider {
	return {
		name,
		capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false }),
		execute: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }),
	};
}

function mockRegistry(providers: ILLMProvider[]): IProviderRegistry {
	return {
		register: () => {},
		get: (n: string) => providers.find((p) => p.name === n),
		list: () => providers,
		select: () => { throw new Error("unused"); },
	};
}

describe("hasLLMProvider", () => {
	it("returns false when registry is undefined", () => {
		expect(hasLLMProvider(undefined)).toBe(false);
	});

	it("returns false when registry has no providers", () => {
		expect(hasLLMProvider(mockRegistry([]))).toBe(false);
	});

	it("returns true when registry has at least one provider", () => {
		expect(hasLLMProvider(mockRegistry([mockProvider("anthropic")]))).toBe(true);
	});

	it("returns true when registry has cursor only", () => {
		expect(hasLLMProvider(mockRegistry([mockProvider("cursor")]))).toBe(true);
	});

	it("returns true when registry has multiple providers", () => {
		expect(hasLLMProvider(mockRegistry([mockProvider("anthropic"), mockProvider("cursor"), mockProvider("ollama")]))).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-availability.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module `llm-availability.js` not found

### Task 2: Implement `hasLLMProvider` helper

**Files:**
- Create: `src/domain/agents/llm-availability.ts`

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * llm-availability.ts — Pure check for LLM provider availability.
 *
 * Domain-layer helper — no I/O, no side effects.
 * UI guards call this instead of hardcoding CLI binary checks.
 */

import type { IProviderRegistry } from "./llm-types.js";

/** Returns true when at least one LLM provider is registered. */
export function hasLLMProvider(registry?: IProviderRegistry): boolean {
	if (!registry) return false;
	return registry.list().length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-availability.test.ts --config configs/vitest.config.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/llm-availability.ts" "01 - Projects/Flowti CLI/tests/domain/agents/llm-availability.test.ts"
git commit -m "feat(agents): add hasLLMProvider domain helper for provider-agnostic UI guards"
```

---

## Chunk 2: Thread `providerRegistry` into Menu Deps

### Task 3: Add `providerRegistry` to menu dep types

**Files:**
- Modify: `src/infrastructure/deps.ts`
- Modify: `src/ui/menus/agents-interact-menu.ts` (type only)
- Modify: `src/ui/menus/agents-run-menu.ts` (type only)
- Modify: `src/ui/menus/roster-task-menu.ts` (type only)

The three menu dep types currently are:

```typescript
// agents-interact-menu.ts:15
export type TalkDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner };

// agents-run-menu.ts:8
export type RunMenuDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "input" | "log" | "processRunner">;

// roster-task-menu.ts:23
export type RosterTaskDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner };
```

All need `providerRegistry` added.

- [ ] **Step 6: Update `TalkDeps` in `agents-interact-menu.ts`**

At line 15, change:
```typescript
export type TalkDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner };
```
to:
```typescript
export type TalkDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner; readonly providerRegistry?: IProviderRegistry };
```

Add this import near the top of the file (alongside the existing imports):
```typescript
import type { IProviderRegistry } from "../../domain/agents/llm-types.js";
```

- [ ] **Step 7: Update `RunMenuDeps` in `agents-run-menu.ts`**

At line 8, change:
```typescript
export type RunMenuDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "input" | "log" | "processRunner">;
```
to:
```typescript
export type RunMenuDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "input" | "log" | "processRunner" | "providerRegistry">;
```

- [ ] **Step 8: Update `RosterTaskDeps` in `roster-task-menu.ts`**

At line 23, change:
```typescript
export type RosterTaskDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner };
```
to:
```typescript
export type RosterTaskDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner; readonly providerRegistry?: IProviderRegistry };
```

Add this import near the top:
```typescript
import type { IProviderRegistry } from "../../domain/agents/llm-types.js";
```

- [ ] **Step 9: Type check passes**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors. The new fields are optional (`?`), so existing callers remain valid.

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/agents-interact-menu.ts" "01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts" "01 - Projects/Flowti CLI/src/ui/menus/roster-task-menu.ts"
git commit -m "feat(agents): thread providerRegistry into menu dep types"
```

---

## Chunk 3: Replace Hardcoded Guards

### Task 4: Replace guards in `agents-interact-menu.ts`

**Files:**
- Modify: `src/ui/menus/agents-interact-menu.ts:141,315`

Two locations check `deps.shell.check("claude --version")`. Both should use `hasLLMProvider`.

- [ ] **Step 11: Add import at top of file**

Add alongside existing imports:
```typescript
import { hasLLMProvider } from "../../domain/agents/llm-availability.js";
```

- [ ] **Step 12: Replace guard at line 141 (`talkToAgentInteractive`)**

Change:
```typescript
	if (!deps.shell.check("claude --version")) {
		deps.log(`  ${RED}Claude CLI is not installed or not in PATH.${RESET}`);
		deps.log(`  ${DIM}Install it to enable agent conversations.${RESET}\n`);
		return;
	}
```
to:
```typescript
	if (!hasLLMProvider(deps.providerRegistry)) {
		deps.log(`  ${RED}No LLM provider available.${RESET}`);
		deps.log(`  ${DIM}Install Claude CLI or Cursor to enable agent conversations.${RESET}\n`);
		return;
	}
```

- [ ] **Step 13: Replace guard at line 315 (`clarifyTaskInteractive`)**

Change:
```typescript
	if (agent.agentType !== "ai" || !deps.shell.check("claude --version")) return;
```
to:
```typescript
	if (agent.agentType !== "ai" || !hasLLMProvider(deps.providerRegistry)) return;
```

### Task 5: Replace guards in `agents-run-menu.ts`

**Files:**
- Modify: `src/ui/menus/agents-run-menu.ts:41,80`

- [ ] **Step 14: Add import at top of file**

Add alongside existing imports:
```typescript
import { hasLLMProvider } from "../../domain/agents/llm-availability.js";
```

- [ ] **Step 15: Replace guard at line 41 (`runBriefInteractive`)**

Change:
```typescript
	if (!deps.shell.check("claude --version")) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
```
to:
```typescript
	if (!hasLLMProvider(deps.providerRegistry)) {
		deps.log("\n  No LLM provider available. Install Claude CLI or Cursor.\n");
		return;
	}
```

- [ ] **Step 16: Replace guard at line 80 (`spawnAndStream`)**

Change:
```typescript
	if (!deps.shell.check("claude --version")) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
```
to:
```typescript
	if (!hasLLMProvider(deps.providerRegistry)) {
		deps.log("\n  No LLM provider available. Install Claude CLI or Cursor.\n");
		return;
	}
```

### Task 6: Replace guard in `roster-task-menu.ts`

**Files:**
- Modify: `src/ui/menus/roster-task-menu.ts:68`

- [ ] **Step 17: Add import at top of file**

Add alongside existing imports:
```typescript
import { hasLLMProvider } from "../../domain/agents/llm-availability.js";
```

- [ ] **Step 18: Replace guard at line 68 (`assignTaskToAgent`)**

Change:
```typescript
	if (agent.agentType === "ai" && deps.shell.check("claude --version")) {
```
to:
```typescript
	if (agent.agentType === "ai" && hasLLMProvider(deps.providerRegistry)) {
```

### Task 7: Update display string in `agent-run-display.ts`

**Files:**
- Modify: `src/ui/displays/agent-run-display.ts:21`

- [ ] **Step 19: Replace hardcoded Claude command hint**

Change:
```typescript
	log(`  ${CYAN}claude --print --prompt-file "${briefPath}"${RESET}`);
```
to:
```typescript
	log(`  ${CYAN}cat "${briefPath}" | <your-llm-cli> --print${RESET}`);
```

This is a hint for the user, not an executed command. The generic form works for both `claude` and `cursor`.

### Task 8: Replace guard in TUI chat page

**Files:**
- Modify: `src/tui/pages/agents-chat-page.tsx:41-48`

The TUI Ink-based chat page has the same hardcoded check.

- [ ] **Step 20: Add import at top of file**

Add alongside existing imports:
```typescript
import { hasLLMProvider } from "../../domain/agents/llm-availability.js";
```

- [ ] **Step 21: Replace guard at line 41**

Change:
```typescript
			const hasClaude = tui.deps.shell.check("claude --version");
			if (!hasClaude) {
				if (!cancelled) {
					setConnectionError("Claude CLI not found. Install Claude Code or add it to PATH.");
					setConnectionStatus("error");
				}
				return;
			}
```
to:
```typescript
			if (!hasLLMProvider(tui.deps.providerRegistry)) {
				if (!cancelled) {
					setConnectionError("No LLM provider available. Install Claude CLI or Cursor.");
					setConnectionStatus("error");
				}
				return;
			}
```

- [ ] **Step 22: Type check and run all tests**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: Type check clean. Tests may have failures in the display test and agents-menu tests — addressed in the next chunk.

- [ ] **Step 23: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/agents-interact-menu.ts" "01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts" "01 - Projects/Flowti CLI/src/ui/menus/roster-task-menu.ts" "01 - Projects/Flowti CLI/src/ui/displays/agent-run-display.ts" "01 - Projects/Flowti CLI/src/tui/pages/agents-chat-page.tsx"
git commit -m "feat(agents): replace hardcoded claude --version guards with hasLLMProvider"
```

---

## Chunk 4: Update Tests

### Task 9: Fix `agent-run-display.test.ts`

**Files:**
- Modify: `tests/ui/displays/agent-run-display.test.ts`

- [ ] **Step 24: Update assertion for manual run command**

At the test `"shows manual run command"` (around line 24-28), change:

```typescript
	it("shows manual run command", () => {
		const { log, lines } = capture();
		renderBriefGenerated("/brief.md", "Agent", log);
		expect(lines.join("\n")).toContain("claude --print --prompt-file");
	});
```
to:
```typescript
	it("shows manual run command hint", () => {
		const { log, lines } = capture();
		renderBriefGenerated("/brief.md", "Agent", log);
		expect(lines.join("\n")).toContain("--print");
	});
```

### Task 10: Add `providerRegistry` to `agents-run-menu.test.ts` mock deps

**Files:**
- Modify: `tests/ui/menus/agents-run-menu.test.ts`

The existing `makeDeps()` function creates mock deps. The `shell.check` mock returns `true`, which previously enabled the Claude guard. Now the guard uses `providerRegistry` instead.

- [ ] **Step 25: Add mock registry to `makeDeps()`**

In `makeDeps()` (around line 46-62), add after the `processRunner` field:

```typescript
		providerRegistry: {
			register: vi.fn(),
			get: vi.fn(),
			list: vi.fn(() => [{ name: "anthropic", capabilities: () => ({}), execute: vi.fn() }]),
			select: vi.fn(),
		} as unknown as RunMenuDeps["providerRegistry"],
```

### Task 11: Add `providerRegistry` to `roster-task-menu.test.ts` mock deps

**Files:**
- Modify: `tests/ui/menus/roster-task-menu.test.ts`

- [ ] **Step 26: Find the mock deps factory in this test file and add `providerRegistry`**

Look for the mock deps construction (pattern matches `agents-run-menu.test.ts`). Add the same mock registry object:

```typescript
		providerRegistry: {
			register: vi.fn(),
			get: vi.fn(),
			list: vi.fn(() => [{ name: "anthropic", capabilities: () => ({}), execute: vi.fn() }]),
			select: vi.fn(),
		},
```

### Task 12: Fix `agents-menu.test.ts` — update mock deps and guard assertions

**Files:**
- Modify: `tests/ui/menus/agents-menu.test.ts`

This file has two tests that assert the old `claude --version` guard behavior:
- Line 445: `"shows error when Claude CLI is not installed"` — sets `deps.shell.check.mockReturnValue(false)` and asserts `"not installed"`
- Line 672: `"skips when Claude CLI is not installed"` — same pattern

After the change, these tests pass **for the wrong reason** (because `providerRegistry` is `undefined`, which makes `hasLLMProvider` return `false`). They need explicit `providerRegistry` mocking.

- [ ] **Step 27: Add `providerRegistry` to `makeDeps()` in `agents-menu.test.ts`**

In `makeDeps()` (around line 109-128), add a `providerRegistry` field that returns a populated registry (to match the default happy path where providers exist):

```typescript
		providerRegistry: {
			register: vi.fn(),
			get: vi.fn(),
			list: vi.fn(() => [{ name: "anthropic", capabilities: () => ({}), execute: vi.fn() }]),
			select: vi.fn(),
		},
```

- [ ] **Step 28: Update guard test at line 445 — "no provider" path**

Change:
```typescript
	it("shows error when Claude CLI is not installed", async () => {
		const deps = makeDeps();
		deps.shell.check.mockReturnValue(false);
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not installed"));
		expect(deps.processRunner.spawn).not.toHaveBeenCalled();
	});
```
to:
```typescript
	it("shows error when no LLM provider is available", async () => {
		const deps = makeDeps();
		deps.providerRegistry.list.mockReturnValue([]);
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No LLM provider"));
		expect(deps.processRunner.spawn).not.toHaveBeenCalled();
	});
```

- [ ] **Step 29: Update guard test at line 672 — clarify skip path**

Change:
```typescript
	it("skips when Claude CLI is not installed", async () => {
		const deps = makeDeps();
		deps.shell.check.mockReturnValue(false);
		await clarifyTaskInteractive("/proj", makeAgent(), undefined, "Task", "Desc", "", deps);
		expect(deps.processRunner.spawn).not.toHaveBeenCalled();
	});
```
to:
```typescript
	it("skips when no LLM provider is available", async () => {
		const deps = makeDeps();
		deps.providerRegistry.list.mockReturnValue([]);
		await clarifyTaskInteractive("/proj", makeAgent(), undefined, "Task", "Desc", "", deps);
		expect(deps.processRunner.spawn).not.toHaveBeenCalled();
	});
```

- [ ] **Step 30: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass (7000+).

- [ ] **Step 31: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: Clean.

- [ ] **Step 32: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/"
git commit -m "test(agents): update tests for provider-agnostic UI guards"
```

---

## Out of Scope — Future Cleanup

**Legacy spawn path in `agent-process-runner.ts`:** The `resolveProviderLegacy()` function and the legacy direct-spawn branch (lines 20-120) are dead code in production — `createDefaultDeps()` always passes a registry. Removing it requires:
- Updating 17 test calls in `tests/infrastructure/agent-process-runner.test.ts` to pass a mock registry
- Updating `src/tui/tui-entry.ts:35` to create and pass a registry
- Making the `registry` parameter required

This is a separate task — it doesn't block Cursor support.

---

## Summary

| Chunk | Tasks | New Files | Modified Files | Test Files |
|-------|-------|-----------|----------------|------------|
| 1 — Domain helper | 1-2 | 2 | 0 | 1 |
| 2 — Thread deps | 3 | 0 | 3 | 0 |
| 3 — Replace guards | 4-8 | 0 | 5 | 0 |
| 4 — Update tests | 9-12 | 0 | 0 | 4 |

Total: ~12 files touched, ~60 net lines changed. All existing 7000+ tests should continue passing.

# LLM Provider Abstraction — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified LLM provider abstraction supporting Claude CLI, Cursor CLI, and Ollama behind a single interface, with capability-aware routing and adaptive prompt building.

**Architecture:** Adapter + Capabilities Hybrid. Each provider implements `ILLMProvider` with per-model capabilities. A `ProviderRegistry` handles selection. `IAgentProcessRunner` becomes a thin bridge delegating to the registry, so all existing callers work unchanged.

**Tech Stack:** TypeScript (ES2022, NodeNext, strict), Vitest, zero runtime deps. Ollama uses Node.js built-in `http` module. CLI providers use existing `IShell.spawnBackground()`.

**Spec:** `docs/specs/2026-03-18-llm-provider-abstraction-design.md`

---

## Chunk 1: Core Types + Prompt Formatting

### Task 1: Domain types — `llm-types.ts`

**Files:**
- Create: `src/domain/agents/llm-types.ts`
- Test: `tests/domain/agents/llm-types.test.ts`

- [ ] **Step 1: Write the type assertion tests**

These tests verify the types compile correctly and are structurally sound. They don't test behavior — just that the exported types exist and compose as expected.

```typescript
// tests/domain/agents/llm-types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type {
	ProviderCapabilities, PromptEnvelope, AgentIdentity, LLMTaskContext,
	ResponseFormatHint, LLMRequest, LLMEvent, LLMResult, LLMProcess,
	ILLMProvider, IProviderRegistry, TaskType, SelectionReason,
	ProviderSelection, SelectOptions,
} from "../../../src/domain/agents/llm-types.js";

describe("llm-types", () => {
	it("ProviderCapabilities has required boolean fields", () => {
		expectTypeOf<ProviderCapabilities>().toHaveProperty("streaming");
		expectTypeOf<ProviderCapabilities>().toHaveProperty("thinking");
		expectTypeOf<ProviderCapabilities>().toHaveProperty("toolUse");
		expectTypeOf<ProviderCapabilities>().toHaveProperty("structuredOutput");
	});

	it("PromptEnvelope requires message, everything else optional", () => {
		const envelope: PromptEnvelope = { message: "hello" };
		expectTypeOf(envelope).toMatchTypeOf<PromptEnvelope>();
	});

	it("LLMEvent union covers all event kinds", () => {
		const events: LLMEvent[] = [
			{ kind: "thinking", text: "" },
			{ kind: "text", text: "" },
			{ kind: "tool-start", id: "1", name: "Bash" },
			{ kind: "tool-input", index: 0, json: "{}" },
			{ kind: "tool-end", id: "1" },
			{ kind: "error", message: "fail" },
			{ kind: "usage", inputTokens: 0, outputTokens: 0 },
			{ kind: "done" },
		];
		expectTypeOf(events).toMatchTypeOf<LLMEvent[]>();
	});

	it("ILLMProvider has name, capabilities, and execute", () => {
		expectTypeOf<ILLMProvider>().toHaveProperty("name");
		expectTypeOf<ILLMProvider>().toHaveProperty("capabilities");
		expectTypeOf<ILLMProvider>().toHaveProperty("execute");
	});

	it("SelectionReason is a string union", () => {
		const reasons: SelectionReason[] = ["configured", "routed", "fallback"];
		expectTypeOf(reasons).toMatchTypeOf<SelectionReason[]>();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-types.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `llm-types.js`

- [ ] **Step 3: Create `llm-types.ts` with all type definitions**

```typescript
// src/domain/agents/llm-types.ts
/**
 * llm-types.ts — Unified LLM provider types.
 *
 * Domain-layer contracts for multi-provider LLM support.
 * No I/O, no side effects — pure type definitions and DI interfaces.
 */

import type { AgentAttributes } from "./agent-types.js";

// ── Capabilities ────────────────────────────────────────────────────

/** What a provider+model combination can do. */
export interface ProviderCapabilities {
	readonly streaming: boolean;
	readonly thinking: boolean;
	readonly toolUse: boolean;
	readonly structuredOutput: boolean;
	readonly maxContextTokens?: number;
}

// ── Prompt ──────────────────────────────────────────────────────────

/** Agent identity for prompt building. */
export interface AgentIdentity {
	readonly name: string;
	readonly description?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly experience?: number;
}

/** Task context for clarification flows. Domain-layer type. */
export interface LLMTaskContext {
	readonly taskName: string;
	readonly taskDescription: string;
	readonly context?: string;
}

/** Conversation turn for history. */
export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly content: string;
}

export type ResponseFormatHint = "json" | "text" | "auto";

/** Universal prompt structure — decoupled from provider formatting. */
export interface PromptEnvelope {
	readonly system?: string;
	readonly identity?: AgentIdentity;
	readonly history?: readonly ConversationTurn[];
	readonly message: string;
	readonly responseFormat?: ResponseFormatHint;
	readonly taskContext?: LLMTaskContext;
}

// ── Request / Response ──────────────────────────────────────────────

/** What goes to a provider. */
export interface LLMRequest {
	readonly prompt: PromptEnvelope;
	readonly tools?: readonly string[];
	readonly timeout?: number;
	readonly cwd?: string;
}

/** Universal stream event. */
export type LLMEvent =
	| { readonly kind: "thinking"; readonly text: string }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "tool-start"; readonly id: string; readonly name: string }
	| { readonly kind: "tool-input"; readonly index: number; readonly json: string }
	| { readonly kind: "tool-end"; readonly id: string }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "usage"; readonly inputTokens: number; readonly outputTokens: number }
	| { readonly kind: "done" };

/** Accumulated output from an LLM invocation. */
export interface LLMResult {
	readonly text: string;
	readonly thinking: string;
	readonly exitCode: number;
}

/** Handle to a running LLM invocation. */
export interface LLMProcess {
	onEvent(callback: (event: LLMEvent) => void): () => void;
	readonly result: Promise<LLMResult>;
	kill(): void;
}

// ── Provider interface ──────────────────────────────────────────────

/** Contract every LLM adapter implements. DI boundary — like IFileSystem. */
export interface ILLMProvider {
	readonly name: string;
	capabilities(model?: string): ProviderCapabilities;
	execute(request: LLMRequest): LLMProcess;
}

// ── Registry ────────────────────────────────────────────────────────

export type TaskType = "autonomous" | "conversation" | "utility";
export type SelectionReason = "configured" | "routed" | "fallback";

export interface ProviderSelection {
	readonly provider: ILLMProvider;
	readonly reason: SelectionReason;
}

export interface SelectOptions {
	readonly preferred?: string;
	readonly taskType: TaskType;
	readonly required?: Partial<ProviderCapabilities>;
}

/** Manages available providers and selects the right one. DI boundary. */
export interface IProviderRegistry {
	register(provider: ILLMProvider): void;
	get(name: string): ILLMProvider | undefined;
	list(): readonly ILLMProvider[];
	select(options: SelectOptions): ProviderSelection;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-types.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/llm-types.ts" "01 - Projects/Flowti CLI/tests/domain/agents/llm-types.test.ts"
git commit -m "feat(llm): add core LLM provider types — llm-types.ts"
```

---

### Task 2: Prompt formatting — `llm-prompt.ts`

**Files:**
- Create: `src/domain/agents/llm-prompt.ts`
- Test: `tests/domain/agents/llm-prompt.test.ts`
- Reference: `src/domain/agents/agent-conversation.ts` (existing identity/format logic to extract)

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/agents/llm-prompt.test.ts
import { describe, it, expect } from "vitest";
import { formatPrompt, shouldRequestJson, isPreFormatted } from "../../../src/domain/agents/llm-prompt.js";
import type { PromptEnvelope, ProviderCapabilities } from "../../../src/domain/agents/llm-types.js";

const FULL_CAPS: ProviderCapabilities = { streaming: true, thinking: true, toolUse: true, structuredOutput: true };
const NO_STRUCTURED: ProviderCapabilities = { streaming: true, thinking: false, toolUse: false, structuredOutput: false };

describe("isPreFormatted", () => {
	it("returns true when only message is set", () => {
		expect(isPreFormatted({ message: "hello" })).toBe(true);
	});

	it("returns false when system is set", () => {
		expect(isPreFormatted({ message: "hello", system: "be helpful" })).toBe(false);
	});

	it("returns false when identity is set", () => {
		expect(isPreFormatted({ message: "hello", identity: { name: "Bob" } })).toBe(false);
	});

	it("returns false when history is set", () => {
		expect(isPreFormatted({ message: "hello", history: [{ role: "user", content: "hi" }] })).toBe(false);
	});
});

describe("shouldRequestJson", () => {
	it("returns true for json hint with structuredOutput", () => {
		expect(shouldRequestJson("json", FULL_CAPS)).toBe(true);
	});

	it("returns false for json hint without structuredOutput", () => {
		expect(shouldRequestJson("json", NO_STRUCTURED)).toBe(false);
	});

	it("returns false for text hint regardless", () => {
		expect(shouldRequestJson("text", FULL_CAPS)).toBe(false);
	});

	it("returns true for auto hint with structuredOutput", () => {
		expect(shouldRequestJson("auto", FULL_CAPS)).toBe(true);
	});

	it("returns true for undefined hint with structuredOutput", () => {
		expect(shouldRequestJson(undefined, FULL_CAPS)).toBe(true);
	});

	it("returns false for undefined hint without structuredOutput", () => {
		expect(shouldRequestJson(undefined, NO_STRUCTURED)).toBe(false);
	});
});

describe("formatPrompt", () => {
	it("includes system instructions when present", () => {
		const envelope: PromptEnvelope = { message: "hello", system: "Be a pirate" };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("# System Instructions");
		expect(result).toContain("Be a pirate");
	});

	it("includes identity block", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Atlas", persona: "Alice" } };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("Alice (Atlas)");
	});

	it("includes JSON response format when structuredOutput is true", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("You MUST respond with a single JSON object");
	});

	it("omits JSON response format when structuredOutput is false", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, NO_STRUCTURED);
		expect(result).not.toContain("You MUST respond with a single JSON object");
	});

	it("includes conversation history", () => {
		const envelope: PromptEnvelope = {
			message: "what next?",
			identity: { name: "Bot" },
			history: [
				{ role: "user", content: "start" },
				{ role: "agent", content: "ok" },
			],
		};
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("# Conversation So Far");
		expect(result).toContain("**User:** start");
		expect(result).toContain("**Bot:** ok");
	});

	it("includes task context for clarification flows", () => {
		const envelope: PromptEnvelope = {
			message: "clarify",
			taskContext: { taskName: "Fix bug", taskDescription: "Broken login", context: "Sprint 5" },
		};
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("Fix bug");
		expect(result).toContain("Broken login");
		expect(result).toContain("Sprint 5");
	});

	it("includes user message at the end", () => {
		const envelope: PromptEnvelope = { message: "do the thing", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("**User:** do the thing");
	});

	it("uses text closing when no structuredOutput", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, NO_STRUCTURED);
		expect(result).toContain("Respond as Bot:");
		expect(result).not.toContain("JSON format above");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-prompt.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `llm-prompt.js`

- [ ] **Step 3: Create `llm-prompt.ts`**

```typescript
// src/domain/agents/llm-prompt.ts
/**
 * llm-prompt.ts — Capability-aware prompt formatting.
 *
 * Pure functions. No I/O, no side effects.
 * Builds prompt strings from PromptEnvelope, adapting to provider capabilities.
 */

import type { PromptEnvelope, ProviderCapabilities, ResponseFormatHint, AgentIdentity } from "./llm-types.js";
import type { AgentAttributes } from "./agent-types.js";

// ── Pre-formatted detection ─────────────────────────────────────────

/** True when the envelope is a raw pre-built prompt string (bridge mode). */
export function isPreFormatted(envelope: PromptEnvelope): boolean {
	return !envelope.system && !envelope.identity && !envelope.history;
}

// ── JSON format decision ────────────────────────────────────────────

export function shouldRequestJson(hint: ResponseFormatHint | undefined, caps: ProviderCapabilities): boolean {
	if (hint === "text") return false;
	if (hint === "json") return caps.structuredOutput;
	return caps.structuredOutput;
}

// ── Response format block ───────────────────────────────────────────

const RESPONSE_FORMAT = `# Response Format

You are in a **live chat**. Keep responses short, conversational, and to the point — 1-3 sentences max. No essays, no bullet lists unless asked.

You MUST respond with a single JSON object. No text before or after the JSON.

\`\`\`json
{
  "message": "Your response text here",
  "status": "message | question | ready | error"
}
\`\`\`

Status values:
- "message" — a statement, answer, or general response
- "question" — you are asking the user a question and need their input
- "ready" — you confirm understanding and are ready to proceed
- "error" — you cannot proceed due to missing information or a problem`;

// ── Identity block ──────────────────────────────────────────────────

function formatAttributes(attrs: AgentAttributes): string {
	const parts: string[] = [];
	if (attrs.str !== undefined) parts.push(`STR ${attrs.str}`);
	if (attrs.int !== undefined) parts.push(`INT ${attrs.int}`);
	if (attrs.wis !== undefined) parts.push(`WIS ${attrs.wis}`);
	if (attrs.cha !== undefined) parts.push(`CHA ${attrs.cha}`);
	if (attrs.dex !== undefined) parts.push(`DEX ${attrs.dex}`);
	if (attrs.con !== undefined) parts.push(`CON ${attrs.con}`);
	return parts.join(", ");
}

function hasCharacterTraits(id: AgentIdentity): boolean {
	return !!(id.mood || id.personality || id.attributes || id.experience !== undefined);
}

function buildIdentityBlock(id: AgentIdentity): string {
	const lines: string[] = [];
	const displayName = id.persona ? `${id.persona} (${id.name})` : id.name;
	lines.push(`You are **${displayName}**.`);
	if (id.description) lines.push(id.description);
	lines.push("");
	if (id.mood) lines.push(`**Disposition**: ${id.mood}`);
	if (id.personality && id.personality.length > 0) lines.push(`**Personality**: ${id.personality.join(". ")}`);
	if (id.attributes) lines.push(`**Attributes**: ${formatAttributes(id.attributes)}`);
	if (id.experience !== undefined) lines.push(`**Experience**: ${id.experience} XP`);
	if (hasCharacterTraits(id)) {
		lines.push("");
		lines.push("Stay in character. Let your personality and attributes shape how you respond — a high-INT agent reasons deeply, a high-CHA agent communicates warmly, a high-DEX agent moves quickly between ideas.");
	} else {
		lines.push("Stay in character and respond naturally.");
	}
	return lines.join("\n");
}

// ── Main formatter ──────────────────────────────────────────────────

/** Build a prompt string from PromptEnvelope, adapting to provider capabilities. */
export function formatPrompt(envelope: PromptEnvelope, caps: ProviderCapabilities): string {
	const parts: string[] = [];
	const useJson = shouldRequestJson(envelope.responseFormat, caps);
	const name = envelope.identity?.name ?? "Agent";

	if (envelope.system) {
		parts.push("# System Instructions\n");
		parts.push(envelope.system);
		parts.push("");
	}

	if (envelope.identity) {
		parts.push(buildIdentityBlock(envelope.identity));
		parts.push("");
	}

	if (useJson) {
		parts.push(RESPONSE_FORMAT);
		parts.push("");
	}

	if (envelope.taskContext) {
		parts.push("# Assigned Task\n");
		parts.push(`**Task:** ${envelope.taskContext.taskName}`);
		parts.push(`**Description:** ${envelope.taskContext.taskDescription}`);
		if (envelope.taskContext.context) parts.push(`**Context:** ${envelope.taskContext.context}`);
		parts.push("");
	}

	if (envelope.history && envelope.history.length > 0) {
		parts.push("# Conversation So Far\n");
		for (const turn of envelope.history) {
			const label = turn.role === "user" ? "User" : name;
			parts.push(`**${label}:** ${turn.content}\n`);
		}
	}

	parts.push(`**User:** ${envelope.message}\n`);

	if (useJson) {
		parts.push(`Respond as ${name} using the JSON format above:`);
	} else {
		parts.push(`Respond as ${name}:`);
	}

	return parts.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-prompt.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/llm-prompt.ts" "01 - Projects/Flowti CLI/tests/domain/agents/llm-prompt.test.ts"
git commit -m "feat(llm): add capability-aware prompt formatting — llm-prompt.ts"
```

---

### Task 3: Routing helpers — `llm-router.ts`

**Files:**
- Create: `src/domain/agents/llm-router.ts`
- Test: `tests/domain/agents/llm-router.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/agents/llm-router.test.ts
import { describe, it, expect } from "vitest";
import { selectForUtility } from "../../../src/domain/agents/llm-router.js";
import type { IProviderRegistry, ILLMProvider, ProviderCapabilities, LLMRequest, LLMProcess, SelectOptions } from "../../../src/domain/agents/llm-types.js";

function mockProvider(name: string, caps: Partial<ProviderCapabilities> = {}): ILLMProvider {
	return {
		name,
		capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false, ...caps }),
		execute: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }),
	};
}

function mockRegistry(providers: ILLMProvider[]): IProviderRegistry {
	const map = new Map(providers.map((p) => [p.name, p]));
	return {
		register: () => {},
		get: (name) => map.get(name),
		list: () => [...map.values()],
		select: (opts: SelectOptions) => {
			const prov = opts.preferred ? map.get(opts.preferred) : providers[0];
			return { provider: prov ?? providers[0], reason: "fallback" as const };
		},
	};
}

describe("selectForUtility", () => {
	it("returns a provider selection", () => {
		const ollama = mockProvider("ollama");
		const registry = mockRegistry([ollama]);
		const result = selectForUtility(registry);
		expect(result.provider.name).toBe("ollama");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-router.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `llm-router.js`

- [ ] **Step 3: Create `llm-router.ts`**

```typescript
// src/domain/agents/llm-router.ts
/**
 * llm-router.ts — Routing helpers for LLM provider selection.
 *
 * Pure functions. No I/O, no side effects.
 */

import type { IProviderRegistry, ProviderSelection } from "./llm-types.js";

/** Select a provider for lightweight utility tasks (summarization, classification). */
export function selectForUtility(registry: IProviderRegistry): ProviderSelection {
	return registry.select({ taskType: "utility", required: { streaming: true } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/llm-router.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/llm-router.ts" "01 - Projects/Flowti CLI/tests/domain/agents/llm-router.test.ts"
git commit -m "feat(llm): add routing helpers — llm-router.ts"
```

---

## Chunk 2: Provider Registry + Backward Compat Aliases

### Task 4: Provider registry — `provider-registry.ts`

**Files:**
- Create: `src/infrastructure/llm/provider-registry.ts`
- Test: `tests/infrastructure/llm/provider-registry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/infrastructure/llm/provider-registry.test.ts
import { describe, it, expect } from "vitest";
import { createProviderRegistry } from "../../../src/infrastructure/llm/provider-registry.js";
import type { ILLMProvider, ProviderCapabilities, LLMRequest, LLMProcess } from "../../../src/domain/agents/llm-types.js";

function mockProvider(name: string, caps: Partial<ProviderCapabilities> = {}): ILLMProvider {
	const defaults: ProviderCapabilities = { streaming: true, thinking: false, toolUse: false, structuredOutput: false };
	return {
		name,
		capabilities: () => ({ ...defaults, ...caps }),
		execute: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }),
	};
}

describe("createProviderRegistry", () => {
	describe("register and get", () => {
		it("registers and retrieves a provider by name", () => {
			const registry = createProviderRegistry();
			const claude = mockProvider("anthropic");
			registry.register(claude);
			expect(registry.get("anthropic")).toBe(claude);
		});

		it("returns undefined for unknown provider", () => {
			const registry = createProviderRegistry();
			expect(registry.get("unknown")).toBeUndefined();
		});

		it("lists all registered providers", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic"));
			registry.register(mockProvider("cursor"));
			expect(registry.list()).toHaveLength(2);
		});
	});

	describe("select — preferred", () => {
		it("selects preferred provider when it meets requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic", { toolUse: true }));
			registry.register(mockProvider("cursor", { toolUse: true }));
			const result = registry.select({ preferred: "cursor", taskType: "conversation", required: { toolUse: true } });
			expect(result.provider.name).toBe("cursor");
			expect(result.reason).toBe("configured");
		});

		it("skips preferred provider when it does not meet requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic", { toolUse: true }));
			registry.register(mockProvider("ollama", { toolUse: false }));
			const result = registry.select({ preferred: "ollama", taskType: "autonomous", required: { toolUse: true } });
			expect(result.provider.name).toBe("anthropic");
			expect(result.reason).toBe("fallback");
		});
	});

	describe("select — utility routing", () => {
		it("routes utility tasks to ollama when available", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic"));
			registry.register(mockProvider("ollama"));
			const result = registry.select({ taskType: "utility", required: { streaming: true } });
			expect(result.provider.name).toBe("ollama");
			expect(result.reason).toBe("routed");
		});

		it("falls back when ollama is not registered", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic"));
			const result = registry.select({ taskType: "utility", required: { streaming: true } });
			expect(result.provider.name).toBe("anthropic");
			expect(result.reason).toBe("fallback");
		});
	});

	describe("select — fallback", () => {
		it("returns first provider meeting requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic", { thinking: true }));
			registry.register(mockProvider("cursor"));
			const result = registry.select({ taskType: "conversation", required: { thinking: true } });
			expect(result.provider.name).toBe("anthropic");
			expect(result.reason).toBe("fallback");
		});

		it("throws when no provider meets requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("ollama"));
			expect(() => registry.select({
				taskType: "autonomous",
				required: { toolUse: true },
			})).toThrow(/No provider/);
		});

		it("throws when registry is empty", () => {
			const registry = createProviderRegistry();
			expect(() => registry.select({ taskType: "conversation" })).toThrow(/No provider/);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/provider-registry.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `provider-registry.js`

- [ ] **Step 3: Create the infrastructure directory and `provider-registry.ts`**

Run: `ls "01 - Projects/Flowti CLI/src/infrastructure/"` to confirm the directory exists, then:

```typescript
// src/infrastructure/llm/provider-registry.ts
/**
 * provider-registry.ts — Manages available LLM providers and selects the right one.
 *
 * Implements IProviderRegistry (domain contract).
 * Selection logic: preferred → utility-route-to-ollama → fallback → throw.
 */

import type { IProviderRegistry, ILLMProvider, SelectOptions, ProviderSelection, ProviderCapabilities } from "../../domain/agents/llm-types.js";

function meetsRequirements(caps: ProviderCapabilities, required?: Partial<ProviderCapabilities>): boolean {
	if (!required) return true;
	if (required.streaming !== undefined && caps.streaming !== required.streaming) return false;
	if (required.thinking !== undefined && caps.thinking !== required.thinking) return false;
	if (required.toolUse !== undefined && caps.toolUse !== required.toolUse) return false;
	if (required.structuredOutput !== undefined && caps.structuredOutput !== required.structuredOutput) return false;
	return true;
}

export function createProviderRegistry(): IProviderRegistry {
	const providers = new Map<string, ILLMProvider>();

	return {
		register(provider) {
			providers.set(provider.name, provider);
		},

		get(name) {
			return providers.get(name);
		},

		list() {
			return [...providers.values()];
		},

		select(options: SelectOptions): ProviderSelection {
			const { preferred, taskType, required } = options;

			// 1. Preferred provider, if it meets requirements
			if (preferred) {
				const prov = providers.get(preferred);
				if (prov && meetsRequirements(prov.capabilities(), required)) {
					return { provider: prov, reason: "configured" };
				}
			}

			// 2. Utility tasks → route to ollama when available
			if (taskType === "utility") {
				const ollama = providers.get("ollama");
				if (ollama && meetsRequirements(ollama.capabilities(), required)) {
					return { provider: ollama, reason: "routed" };
				}
			}

			// 3. Fallback — first provider meeting requirements
			for (const prov of providers.values()) {
				if (meetsRequirements(prov.capabilities(), required)) {
					return { provider: prov, reason: "fallback" };
				}
			}

			// 4. Nothing works
			const names = [...providers.keys()].join(", ") || "none registered";
			const reqs = required ? JSON.stringify(required) : "none";
			throw new Error(`No provider meets requirements (${reqs}). Available: ${names}`);
		},
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/provider-registry.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/provider-registry.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/provider-registry.test.ts"
git commit -m "feat(llm): add provider registry with selection logic"
```

---

### Task 5: Backward compatibility — re-export type aliases

**Files:**
- Modify: `src/domain/agents/agent-stream.ts:10-18` (add re-export of LLMEvent)
- Modify: `src/domain/agents/worker-types.ts:45-49` (add re-export of LLMProcess)
- Modify: `src/domain/agents/agent-shell.ts:22-26` (add re-export of LLMResult)

- [ ] **Step 1: Add LLMEvent re-export to agent-stream.ts**

At the top of `src/domain/agents/agent-stream.ts`, after the existing `AgentStreamEvent` type definition (line 18), add:

```typescript
// Backward compat — AgentStreamEvent is now an alias for LLMEvent
export type { LLMEvent } from "./llm-types.js";
```

The existing `AgentStreamEvent` type stays as-is. Both types are structurally identical — callers can use either.

- [ ] **Step 2: Add LLMProcess re-export to worker-types.ts**

At the end of `src/domain/agents/worker-types.ts` (after line 77), add:

```typescript
// Backward compat — LLMProcess is the canonical type for LLMProcess
export type { LLMProcess, LLMResult } from "./llm-types.js";
```

- [ ] **Step 3: Add LLMResult re-export to agent-shell.ts**

At the end of `src/domain/agents/agent-shell.ts` (after line 77), add:

```typescript
// Backward compat — AgentProcessResult is structurally identical to LLMResult
export type { LLMResult } from "./llm-types.js";
```

- [ ] **Step 4: Run type check to verify no breakage**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 5: Run full test suite to verify no breakage**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: all existing tests pass

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-stream.ts" "01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts" "01 - Projects/Flowti CLI/src/domain/agents/agent-shell.ts"
git commit -m "feat(llm): add backward-compat type aliases for LLMEvent, LLMProcess, LLMResult"
```

---

## Chunk 3: Claude Provider Adapter

### Task 6: Shared prompt file utility — `prompt-file.ts`

**Files:**
- Create: `src/infrastructure/llm/prompt-file.ts`
- Test: `tests/infrastructure/llm/prompt-file.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/infrastructure/llm/prompt-file.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));

import { writePromptFile, cleanupPromptFile } from "../../../src/infrastructure/llm/prompt-file.js";
import type { IFileSystem, IPaths, IClock } from "../../../src/infrastructure/types.js";

function makeDeps() {
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } as unknown as IFileSystem,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as unknown as IPaths,
		clock: { ms: vi.fn(() => 9999) } as unknown as IClock,
	};
}

describe("writePromptFile", () => {
	it("writes prompt to a temp file and returns the path", () => {
		const deps = makeDeps();
		const path = writePromptFile(deps, "hello world");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(path, "hello world", "utf-8");
		expect(path).toContain(".flowti-prompt-");
	});
});

describe("cleanupPromptFile", () => {
	it("deletes the temp file silently", () => {
		const deps = makeDeps();
		cleanupPromptFile(deps, "/tmp/prompt.tmp");
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith("/tmp/prompt.tmp");
	});

	it("does not throw if file is already gone", () => {
		const deps = makeDeps();
		(deps.disk.unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("ENOENT"); });
		expect(() => cleanupPromptFile(deps, "/tmp/gone.tmp")).not.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/prompt-file.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `prompt-file.js`

- [ ] **Step 3: Create `prompt-file.ts`**

```typescript
// src/infrastructure/llm/prompt-file.ts
/**
 * prompt-file.ts — Shared temp file utility for CLI-based LLM providers.
 *
 * Writes prompt text to a temp file for piping via stdin, and cleans up after.
 */

import type { IFileSystem, IPaths, IClock } from "../types.js";

export interface PromptFileDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
}

let counter = 0;

export function writePromptFile(deps: PromptFileDeps, content: string): string {
	const tempPath = deps.paths.join(
		deps.paths.resolve("."),
		`.flowti-prompt-${deps.clock.ms()}-${++counter}.tmp`,
	);
	deps.disk.writeFileSync(tempPath, content, "utf-8");
	return tempPath;
}

export function cleanupPromptFile(deps: Pick<PromptFileDeps, "disk">, path: string): void {
	try { deps.disk.unlinkSync(path); } catch { /* file already gone */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/prompt-file.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/prompt-file.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/prompt-file.test.ts"
git commit -m "feat(llm): add shared prompt file utility for CLI providers"
```

---

### Task 7: Claude provider adapter — `claude-provider.ts`

**Files:**
- Create: `src/infrastructure/llm/claude-provider.ts`
- Test: `tests/infrastructure/llm/claude-provider.test.ts`
- Reference: `src/infrastructure/agent-process-runner.ts` (existing logic to extract)
- Reference: `src/domain/agents/agent-stream.ts` (parseStreamLine)

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/infrastructure/llm/claude-provider.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createClaudeProvider } from "../../../src/infrastructure/llm/claude-provider.js";
import type { LLMRequest } from "../../../src/domain/agents/llm-types.js";

function makeDeps() {
	const outputCallbacks: Array<(line: string) => void> = [];
	const mockProc = {
		waitForExit: vi.fn(() => Promise.resolve(0)),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		running: true,
		output: [],
		waitForOutput: vi.fn(),
	};
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 1234) } as never,
		shell: { spawnBackground: vi.fn(() => mockProc) } as never,
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

describe("createClaudeProvider", () => {
	it("has name 'anthropic'", () => {
		const provider = createClaudeProvider(makeDeps());
		expect(provider.name).toBe("anthropic");
	});

	it("reports full capabilities", () => {
		const provider = createClaudeProvider(makeDeps());
		const caps = provider.capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(true);
		expect(caps.toolUse).toBe(true);
		expect(caps.structuredOutput).toBe(true);
	});

	it("execute spawns claude with stream-json flags", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		const request: LLMRequest = { prompt: { message: "hello" } };
		provider.execute(request);
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
			expect.stringContaining("claude"),
			undefined,
		);
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("--output-format");
		expect(cmd).toContain("stream-json");
	});

	it("execute writes prompt to temp file", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello world" } });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
			expect.any(String),
			"utf-8",
		);
	});

	it("execute includes --allowedTools when tools provided", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello" }, tools: ["Bash", "Read"] });
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("--allowedTools");
		expect(cmd).toContain("Bash,Read");
	});

	it("execute passes cwd when provided", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello" }, cwd: "/work" });
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(expect.any(String), { cwd: "/work" });
	});

	it("result accumulates text events", async () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		const proc = provider.execute({ prompt: { message: "hello" } });
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi!" }] } }));
		}
		const result = await proc.result;
		expect(result.text).toBe("Hi!");
		expect(result.exitCode).toBe(0);
	});

	it("emits events to subscribers", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		const proc = provider.execute({ prompt: { message: "hello" } });
		const events: unknown[] = [];
		proc.onEvent((e) => events.push(e));
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi!" }] } }));
		}
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ kind: "text", text: "Hi!" });
	});

	it("uses pre-formatted prompt when envelope is message-only", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "pre-built prompt string" } });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.any(String),
			"pre-built prompt string",
			"utf-8",
		);
	});

	it("uses formatPrompt when envelope has identity", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello", identity: { name: "Bot" } } });
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("You are **Bot**");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/claude-provider.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `claude-provider.js`

- [ ] **Step 3: Create `claude-provider.ts`**

```typescript
// src/infrastructure/llm/claude-provider.ts
/**
 * claude-provider.ts — Claude CLI adapter implementing ILLMProvider.
 *
 * Spawns `claude -p --output-format stream-json --verbose`, parses NDJSON output.
 * Reuses existing parseStreamLine() from agent-stream.ts.
 */

import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities } from "../../domain/agents/llm-types.js";
import { parseStreamLine, createStreamState, updateStreamState } from "../../domain/agents/agent-stream.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";
import { writePromptFile, cleanupPromptFile } from "./prompt-file.js";
import type { PromptFileDeps } from "./prompt-file.js";
import type { IShell } from "../types.js";

export interface ClaudeProviderDeps extends PromptFileDeps {
	readonly shell: IShell;
}

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: true,
	toolUse: true,
	structuredOutput: true,
};

export function createClaudeProvider(deps: ClaudeProviderDeps): ILLMProvider {
	return {
		name: "anthropic",

		capabilities() {
			return CAPABILITIES;
		},

		execute(request: LLMRequest): LLMProcess {
			const prompt = isPreFormatted(request.prompt)
				? request.prompt.message
				: formatPrompt(request.prompt, CAPABILITIES);

			const tempPath = writePromptFile(deps, prompt);

			const args = ["-p", "--output-format", "stream-json", "--verbose"];
			if (request.tools && request.tools.length > 0) {
				args.push("--allowedTools", request.tools.join(","));
			}

			const quotedPath = `"${tempPath}"`;
			const cmd = ["claude", ...args.map((a) => a.includes(" ") ? `"${a}"` : a)].join(" ") + ` < ${quotedPath}`;
			const proc = deps.shell.spawnBackground(cmd, request.cwd ? { cwd: request.cwd } : undefined);
			const timeout = request.timeout ?? 3_600_000;
			const exitPromise = proc.waitForExit(timeout);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const subscribers = new Set<(event: LLMEvent) => void>();

			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				const event = parseStreamLine(line, streamState);
				if (!event) return;
				if (event.kind === "thinking") thinkingBuffer.push(event.text);
				if (event.kind === "text") textBuffer.push(event.text);
				for (const cb of subscribers) {
					try { cb(event); } catch { /* subscriber error */ }
				}
			});

			return {
				onEvent(callback) {
					subscribers.add(callback);
					return () => { subscribers.delete(callback); };
				},
				result: exitPromise.then((exitCode) => {
					cleanupPromptFile(deps, tempPath);
					return { text: textBuffer.join(""), thinking: thinkingBuffer.join(""), exitCode } as LLMResult;
				}).catch(() => {
					proc.kill();
					cleanupPromptFile(deps, tempPath);
					return { text: "", thinking: "", exitCode: 1 } as LLMResult;
				}),
				kill() {
					proc.kill();
					cleanupPromptFile(deps, tempPath);
				},
			};
		},
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/claude-provider.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/claude-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/claude-provider.test.ts"
git commit -m "feat(llm): add Claude CLI provider adapter"
```

---

## Chunk 4: Cursor + Ollama Provider Adapters

### Task 8: Cursor provider adapter — `cursor-provider.ts`

**Files:**
- Create: `src/infrastructure/llm/cursor-provider.ts`
- Test: `tests/infrastructure/llm/cursor-provider.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/infrastructure/llm/cursor-provider.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createCursorProvider } from "../../../src/infrastructure/llm/cursor-provider.js";

function makeDeps() {
	const outputCallbacks: Array<(line: string) => void> = [];
	const mockProc = {
		waitForExit: vi.fn(() => Promise.resolve(0)),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		running: true,
		output: [],
		waitForOutput: vi.fn(),
	};
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 5678) } as never,
		shell: { spawnBackground: vi.fn(() => mockProc) } as never,
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

describe("createCursorProvider", () => {
	it("has name 'cursor'", () => {
		const provider = createCursorProvider(makeDeps());
		expect(provider.name).toBe("cursor");
	});

	it("reports capabilities without thinking", () => {
		const caps = createCursorProvider(makeDeps()).capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(false);
		expect(caps.toolUse).toBe(true);
		expect(caps.structuredOutput).toBe(true);
	});

	it("spawns cursor binary with --print --json flags", () => {
		const deps = makeDeps();
		createCursorProvider(deps).execute({ prompt: { message: "hello" } });
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("cursor");
		expect(cmd).toContain("--print");
		expect(cmd).toContain("--json");
	});

	it("accumulates text from output lines", async () => {
		const deps = makeDeps();
		const proc = createCursorProvider(deps).execute({ prompt: { message: "hello" } });
		for (const cb of deps._outputCallbacks) {
			cb("Hello from Cursor!");
		}
		const result = await proc.result;
		expect(result.text).toBe("Hello from Cursor!");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/cursor-provider.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `cursor-provider.js`

- [ ] **Step 3: Create `cursor-provider.ts`**

```typescript
// src/infrastructure/llm/cursor-provider.ts
/**
 * cursor-provider.ts — Cursor CLI adapter implementing ILLMProvider.
 *
 * Spawns `cursor --print --json`, parses output.
 * Cursor outputs plain text or JSON — adapter normalizes to LLMEvent.
 */

import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities } from "../../domain/agents/llm-types.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";
import { writePromptFile, cleanupPromptFile } from "./prompt-file.js";
import type { PromptFileDeps } from "./prompt-file.js";
import type { IShell } from "../types.js";

export interface CursorProviderDeps extends PromptFileDeps {
	readonly shell: IShell;
}

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: false,
	toolUse: true,
	structuredOutput: true,
};

export function createCursorProvider(deps: CursorProviderDeps): ILLMProvider {
	return {
		name: "cursor",

		capabilities() {
			return CAPABILITIES;
		},

		execute(request: LLMRequest): LLMProcess {
			const prompt = isPreFormatted(request.prompt)
				? request.prompt.message
				: formatPrompt(request.prompt, CAPABILITIES);

			const tempPath = writePromptFile(deps, prompt);
			const quotedPath = `"${tempPath}"`;
			const cmd = `cursor --print --json < ${quotedPath}`;
			const proc = deps.shell.spawnBackground(cmd, request.cwd ? { cwd: request.cwd } : undefined);
			const timeout = request.timeout ?? 3_600_000;
			const exitPromise = proc.waitForExit(timeout);

			const textBuffer: string[] = [];
			const subscribers = new Set<(event: LLMEvent) => void>();

			proc.onOutput((line: string) => {
				// Cursor outputs text lines — treat each as a text event
				if (!line.trim()) return;
				textBuffer.push(line);
				const event: LLMEvent = { kind: "text", text: line };
				for (const cb of subscribers) {
					try { cb(event); } catch { /* subscriber error */ }
				}
			});

			return {
				onEvent(callback) {
					subscribers.add(callback);
					return () => { subscribers.delete(callback); };
				},
				result: exitPromise.then((exitCode) => {
					cleanupPromptFile(deps, tempPath);
					return { text: textBuffer.join(""), thinking: "", exitCode } as LLMResult;
				}).catch(() => {
					proc.kill();
					cleanupPromptFile(deps, tempPath);
					return { text: "", thinking: "", exitCode: 1 } as LLMResult;
				}),
				kill() {
					proc.kill();
					cleanupPromptFile(deps, tempPath);
				},
			};
		},
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/cursor-provider.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/cursor-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/cursor-provider.test.ts"
git commit -m "feat(llm): add Cursor CLI provider adapter"
```

---

### Task 9: Ollama provider adapter — `ollama-provider.ts`

**Files:**
- Create: `src/infrastructure/llm/ollama-provider.ts`
- Test: `tests/infrastructure/llm/ollama-provider.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/infrastructure/llm/ollama-provider.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOllamaProvider } from "../../../src/infrastructure/llm/ollama-provider.js";
import type { LLMEvent } from "../../../src/domain/agents/llm-types.js";

// Mock http module
const mockRequest = vi.fn();
vi.mock("node:http", () => ({
	request: (...args: unknown[]) => mockRequest(...args),
}));

function setupMockResponse(chunks: string[], statusCode = 200) {
	const responseCallbacks = new Map<string, (...args: unknown[]) => void>();
	const mockRes = {
		statusCode,
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { responseCallbacks.set(event, cb); }),
	};
	const requestCallbacks = new Map<string, (...args: unknown[]) => void>();
	const mockReq = {
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { requestCallbacks.set(event, cb); }),
		write: vi.fn(),
		end: vi.fn(() => {
			// Defer response simulation to next microtask so onEvent subscribers register first
			queueMicrotask(() => {
				const responseCb = requestCallbacks.get("response") ?? mockRequest.mock.calls[0]?.[1];
				if (typeof responseCb === "function") responseCb(mockRes);
				const dataCb = responseCallbacks.get("data");
				if (dataCb) for (const chunk of chunks) dataCb(Buffer.from(chunk + "\n"));
				const endCb = responseCallbacks.get("end");
				if (endCb) endCb();
			});
		}),
		destroy: vi.fn(),
	};
	mockRequest.mockReturnValue(mockReq);
	return { mockReq, mockRes };
}

beforeEach(() => {
	mockRequest.mockReset();
});

describe("createOllamaProvider", () => {
	it("has name 'ollama'", () => {
		expect(createOllamaProvider().name).toBe("ollama");
	});

	it("reports utility-tier capabilities", () => {
		const caps = createOllamaProvider().capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(false);
		expect(caps.toolUse).toBe(false);
		expect(caps.structuredOutput).toBe(false);
	});

	it("execute sends HTTP POST to localhost:11434", async () => {
		setupMockResponse([JSON.stringify({ response: "Hi!", done: false }), JSON.stringify({ response: "", done: true })]);
		const provider = createOllamaProvider();
		const proc = provider.execute({ prompt: { message: "hello" } });
		const result = await proc.result;
		expect(result.text).toBe("Hi!");
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: "localhost", port: 11434, path: "/api/generate", method: "POST" }),
			expect.any(Function),
		);
	});

	it("emits text events for each response chunk", async () => {
		setupMockResponse([JSON.stringify({ response: "chunk1", done: false }), JSON.stringify({ response: "chunk2", done: false }), JSON.stringify({ response: "", done: true })]);
		const provider = createOllamaProvider();
		const proc = provider.execute({ prompt: { message: "hello" } });
		const events: LLMEvent[] = [];
		proc.onEvent((e) => events.push(e));
		await proc.result;
		const textEvents = events.filter((e) => e.kind === "text");
		expect(textEvents).toHaveLength(2);
	});

	it("kill destroys the HTTP request", () => {
		const { mockReq } = setupMockResponse([]);
		const provider = createOllamaProvider();
		const proc = provider.execute({ prompt: { message: "hello" } });
		proc.kill();
		expect(mockReq.destroy).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/ollama-provider.test.ts --config configs/vitest.config.ts`
Expected: FAIL — cannot resolve `ollama-provider.js`

- [ ] **Step 3: Create `ollama-provider.ts`**

```typescript
// src/infrastructure/llm/ollama-provider.ts
/**
 * ollama-provider.ts — Ollama HTTP adapter implementing ILLMProvider.
 *
 * HTTP POST to localhost:11434/api/generate with streaming NDJSON.
 * Utility-tier: no tool use, no thinking, no structured output.
 * Uses Node.js built-in http module (zero deps).
 */

import http from "node:http";
import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities } from "../../domain/agents/llm-types.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: false,
	toolUse: false,
	structuredOutput: false,
};

const DEFAULT_MODEL = "llama3.1";

export function createOllamaProvider(model?: string): ILLMProvider {
	const modelName = model ?? DEFAULT_MODEL;

	return {
		name: "ollama",

		capabilities() {
			return CAPABILITIES;
		},

		execute(request: LLMRequest): LLMProcess {
			const prompt = isPreFormatted(request.prompt)
				? request.prompt.message
				: formatPrompt(request.prompt, CAPABILITIES);

			const textBuffer: string[] = [];
			const subscribers = new Set<(event: LLMEvent) => void>();
			let req: http.ClientRequest | null = null;

			function emit(event: LLMEvent): void {
				for (const cb of subscribers) {
					try { cb(event); } catch { /* subscriber error */ }
				}
			}

			const body = JSON.stringify({ model: modelName, prompt, stream: true });

			const resultPromise = new Promise<LLMResult>((resolve) => {
				req = http.request(
					{ hostname: "localhost", port: 11434, path: "/api/generate", method: "POST", headers: { "Content-Type": "application/json" } },
					(res) => {
						if (res.statusCode !== 200) {
							emit({ kind: "error", message: `Ollama returned status ${res.statusCode}` });
							resolve({ text: "", thinking: "", exitCode: 1 });
							return;
						}
						let lineBuffer = "";
						res.on("data", (chunk: Buffer) => {
							lineBuffer += chunk.toString();
							const lines = lineBuffer.split("\n");
							lineBuffer = lines.pop() ?? "";
							for (const line of lines) {
								if (!line.trim()) continue;
								try {
									const parsed = JSON.parse(line) as Record<string, unknown>;
									if (typeof parsed.response === "string" && parsed.response) {
										textBuffer.push(parsed.response);
										emit({ kind: "text", text: parsed.response });
									}
									if (parsed.done === true) {
										emit({ kind: "done" });
									}
								} catch { /* invalid JSON line */ }
							}
						});
						res.on("end", () => {
							resolve({ text: textBuffer.join(""), thinking: "", exitCode: 0 });
						});
						res.on("error", () => {
							resolve({ text: textBuffer.join(""), thinking: "", exitCode: 1 });
						});
					},
				);
				req.on("error", (err) => {
					emit({ kind: "error", message: err.message });
					resolve({ text: "", thinking: "", exitCode: 1 });
				});
				req.write(body);
				req.end();
			});

			return {
				onEvent(callback) {
					subscribers.add(callback);
					return () => { subscribers.delete(callback); };
				},
				result: resultPromise,
				kill() {
					if (req) req.destroy();
				},
			};
		},
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/ollama-provider.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/cursor-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/cursor-provider.test.ts" "01 - Projects/Flowti CLI/src/infrastructure/llm/ollama-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/ollama-provider.test.ts"
git commit -m "feat(llm): add Cursor + Ollama provider adapters"
```

---

## Chunk 5: Bridge + Wiring + Integration

### Task 10: Rewire `createProcessRunner()` to delegate to registry

**Files:**
- Modify: `src/infrastructure/agent-process-runner.ts` (rewire to delegate)
- Modify: `tests/infrastructure/agent-process-runner.test.ts` (update tests)

- [ ] **Step 1: Update `agent-process-runner.ts` to accept registry**

Replace the existing `resolveProvider()` + internal spawning with delegation to the registry. The function signature adds `registry` as an optional parameter — when provided, it delegates; when absent, it falls back to legacy behavior (during incremental migration).

In `src/infrastructure/agent-process-runner.ts`, replace lines 17-29 (`ProviderConfig` interface and `resolveProvider` function) and update `createProcessRunner` (lines 33-97) to:

```typescript
import type { IProviderRegistry } from "../domain/agents/llm-types.js";

export function createProcessRunner(deps: ProcessRunnerDeps, config: AgentsConfig | undefined, registry?: IProviderRegistry): IAgentProcessRunner {
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;

	return {
		spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess {
			// When registry is available, delegate to it
			if (registry) {
				const selection = registry.select({
					preferred: agent.ai?.provider,
					taskType: "conversation",
					required: { streaming: true },
				});
				return selection.provider.execute({
					prompt: { message: prompt },
					tools: resolvedTools,
					timeout: processTimeout,
					cwd: opts?.cwd,
				});
			}

			// Legacy path — direct spawn (removed after full migration)
			const provider = resolveProviderLegacy(config?.provider, agent.ai?.provider);
			// ... existing legacy code unchanged ...
		},
	};
}
```

Keep the legacy `resolveProviderLegacy` (renamed from `resolveProvider`) as a private function so the file compiles during incremental migration.

- [ ] **Step 2: Add registry delegation test**

Add to `tests/infrastructure/agent-process-runner.test.ts`:

```typescript
it("delegates to registry when provided", () => {
	const deps = makeDeps();
	const mockExecute = vi.fn(() => ({
		onEvent: () => () => {},
		result: Promise.resolve({ text: "from registry", thinking: "", exitCode: 0 }),
		kill: vi.fn(),
	}));
	const mockProvider = {
		name: "anthropic",
		capabilities: () => ({ streaming: true, thinking: true, toolUse: true, structuredOutput: true }),
		execute: mockExecute,
	};
	const mockRegistry = {
		register: vi.fn(),
		get: vi.fn(),
		list: vi.fn(() => []),
		select: vi.fn(() => ({ provider: mockProvider, reason: "configured" as const })),
	};
	const runner = createProcessRunner(deps, undefined, mockRegistry);
	runner.spawn(makeAgent(), "Hello");
	expect(mockRegistry.select).toHaveBeenCalledWith(
		expect.objectContaining({ taskType: "conversation", required: { streaming: true } }),
	);
	expect(mockExecute).toHaveBeenCalledWith(
		expect.objectContaining({ prompt: { message: "Hello" } }),
	);
	// Should NOT call shell.spawnBackground when registry is provided
	expect(deps.shell.spawnBackground).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-process-runner.test.ts --config configs/vitest.config.ts`
Expected: PASS (new test + all existing tests)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-process-runner.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-process-runner.test.ts"
git commit -m "feat(llm): rewire createProcessRunner to delegate to provider registry"
```

---

### Task 11: Wire registry into `deps.ts`

**Files:**
- Modify: `src/infrastructure/deps.ts:9` (add import)
- Modify: `src/infrastructure/deps.ts:35-49` (add `providerRegistry` to `CliDeps`)
- Modify: `src/infrastructure/deps.ts:110-140` (add registry creation in `createDefaultDeps`)

- [ ] **Step 1: Add `IProviderRegistry` to `CliDeps` interface**

At `src/infrastructure/deps.ts`, add import and update interface:

```typescript
// Add to imports (line 9 area)
import type { IProviderRegistry } from "../domain/agents/llm-types.js";
import { createProviderRegistry } from "./llm/provider-registry.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createCursorProvider } from "./llm/cursor-provider.js";
import { createOllamaProvider } from "./llm/ollama-provider.js";

// Add to CliDeps interface (after line 48) — OPTIONAL to avoid breaking createTestDeps()
readonly providerRegistry?: IProviderRegistry;
```

Making it optional (`?`) avoids breaking `createTestDeps()` in `tests/mocks/mock-deps.ts` and all 12+ test files that use it. Production code accesses it via `deps.providerRegistry!` or through `processRunner` (which already has the registry internally).

- [ ] **Step 2: Wire registry in `createDefaultDeps()`**

In `createDefaultDeps()`, after `const baseDeps` (line 115), add:

```typescript
const providerRegistry = createProviderRegistry();
providerRegistry.register(createClaudeProvider(baseDeps));
if (shell.check("cursor --version")) providerRegistry.register(createCursorProvider(baseDeps));
providerRegistry.register(createOllamaProvider());

const processRunner = createProcessRunner(baseDeps, agentsConfig, providerRegistry);
```

Update the return statement to include `providerRegistry`.

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass — no existing behavior changed

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/deps.ts"
git commit -m "feat(llm): wire provider registry into CliDeps + createDefaultDeps"
```

---

### Task 12: Run full quality gate

- [ ] **Step 1: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: no new violations (architecture rules pass — all new domain files are pure, all new infra files are in infrastructure/)

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass

- [ ] **Step 4: Run build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: build succeeds

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A "01 - Projects/Flowti CLI/"
git commit -m "chore(llm): quality gate fixes"
```

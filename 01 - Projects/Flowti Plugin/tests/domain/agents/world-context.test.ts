import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IContextProvider, FileContext } from "../../../src/domain/agents/context-provider.js";
import type { IEventBus } from "../../../src/infrastructure/events/types.js";
import type { WorkspaceDep, VaultAdapterDep, WorldContextDeps } from "../../../src/domain/agents/world-context.js";
import { WorldContext } from "../../../src/domain/agents/world-context.js";

/* ── Mock factories ── */

function createMockContextProvider(): IContextProvider & {
	fireFileChanged: (ctx: FileContext) => void;
} {
	const fileChangedCallbacks: Array<(ctx: FileContext) => void> = [];
	return {
		getActiveFileContext: vi.fn(() => null),
		getDiff: vi.fn(() => null),
		onFileChanged: vi.fn((cb: (ctx: FileContext) => void) => {
			fileChangedCallbacks.push(cb);
			return () => {
				const idx = fileChangedCallbacks.indexOf(cb);
				if (idx !== -1) fileChangedCallbacks.splice(idx, 1);
			};
		}),
		dispose: vi.fn(),
		fireFileChanged(ctx: FileContext) {
			for (const cb of fileChangedCallbacks) cb(ctx);
		},
	};
}

function createMockWorkspace(): WorkspaceDep & {
	fireLayoutChange: () => void;
	setLeaves: (leaves: Array<{ path: string; viewType?: string }>) => void;
} {
	const layoutCallbacks: Array<() => void> = [];
	let leaves: Array<{ path: string; viewType?: string }> = [];

	return {
		on: vi.fn((name: string, cb: () => void) => {
			if (name === "layout-change") layoutCallbacks.push(cb);
			return { id: "mock-ref" };
		}),
		iterateAllLeaves: vi.fn((cb) => {
			for (const leaf of leaves) {
				cb({
					view: {
						file: { path: leaf.path },
						getViewType: () => leaf.viewType ?? "markdown",
					},
				});
			}
		}),
		fireLayoutChange() {
			for (const cb of layoutCallbacks) cb();
		},
		setLeaves(newLeaves) {
			leaves = newLeaves;
		},
	};
}

function createMockVaultAdapter(): VaultAdapterDep {
	return {
		exists: vi.fn(async () => false),
		read: vi.fn(async () => ""),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn(async () => {}),
		emitCustom: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
		once: vi.fn(() => () => {}),
		off: vi.fn(),
		clear: vi.fn(),
	};
}

function createDeps(): {
	deps: WorldContextDeps;
	contextProvider: ReturnType<typeof createMockContextProvider>;
	workspace: ReturnType<typeof createMockWorkspace>;
	vaultAdapter: VaultAdapterDep;
	eventBus: IEventBus;
} {
	const contextProvider = createMockContextProvider();
	const workspace = createMockWorkspace();
	const vaultAdapter = createMockVaultAdapter();
	const eventBus = createMockEventBus();
	return {
		deps: { contextProvider, workspace, vaultAdapter, eventBus },
		contextProvider,
		workspace,
		vaultAdapter,
		eventBus,
	};
}

describe("WorldContext", () => {
	let ctx: WorldContext;
	let contextProvider: ReturnType<typeof createMockContextProvider>;
	let workspace: ReturnType<typeof createMockWorkspace>;

	beforeEach(() => {
		vi.useFakeTimers();
		const mocks = createDeps();
		contextProvider = mocks.contextProvider;
		workspace = mocks.workspace;
		ctx = new WorldContext(mocks.deps);
	});

	describe("serialize()", () => {
		it("includes active file with type", () => {
			contextProvider.fireFileChanged({
				path: "src/game/engine.ts",
				contentHash: "abc",
				content: "export class Engine {}",
			});

			const output = ctx.serialize();
			expect(output).toContain("[World Context — Snapshot]");
			expect(output).toContain("Active file: src/game/engine.ts (TypeScript)");
		});

		it("includes file content snippet in code block", () => {
			contextProvider.fireFileChanged({
				path: "src/game/engine.ts",
				contentHash: "abc",
				content: "export class Engine {}",
			});

			const output = ctx.serialize();
			expect(output).toContain("Content of engine.ts:");
			expect(output).toContain("```\nexport class Engine {}\n```");
		});

		it("truncates long content at 500 chars", () => {
			const longContent = "x".repeat(1000);
			contextProvider.fireFileChanged({
				path: "src/big.ts",
				contentHash: "big",
				content: longContent,
			});

			const output = ctx.serialize();
			expect(output).toContain("[... truncated at 500 chars, full file: 1000 chars]");
		});

		it("includes open files list excluding active file", () => {
			contextProvider.fireFileChanged({
				path: "src/game/engine.ts",
				contentHash: "abc",
				content: "export class Engine {}",
			});
			workspace.setLeaves([
				{ path: "src/game/engine.ts" },
				{ path: "src/domain/agents/types.ts" },
			]);
			// Trigger layout change and advance debounce
			workspace.fireLayoutChange();
			vi.advanceTimersByTime(600);

			const output = ctx.serialize();
			expect(output).toContain("Also open:");
			expect(output).not.toMatch(/Also open:.*engine\.ts/);
			expect(output).toContain("types.ts");
		});

		it("shows all open files when no active file", () => {
			workspace.setLeaves([
				{ path: "src/game/engine.ts" },
				{ path: "src/domain/agents/types.ts" },
			]);
			workspace.fireLayoutChange();
			vi.advanceTimersByTime(600);

			const output = ctx.serialize();
			expect(output).toContain("Also open:");
			expect(output).toContain("engine.ts");
			expect(output).toContain("types.ts");
		});

		it("shows full paths for open files", () => {
			workspace.setLeaves([
				{ path: "src/domain/agents/types.ts" },
				{ path: "src/domain/session/types.ts" },
			]);
			workspace.fireLayoutChange();
			vi.advanceTimersByTime(600);

			const output = ctx.serialize();
			expect(output).toContain("src/domain/agents/types.ts");
			expect(output).toContain("src/domain/session/types.ts");
		});

		it("omits canvas when none open", () => {
			const output = ctx.serialize();
			expect(output).not.toContain("Canvas:");
		});

		it("includes canvas when set", () => {
			ctx.setActiveCanvas({ name: "App Overview", description: "system architecture" });
			const output = ctx.serialize();
			expect(output).toContain('Canvas: "App Overview" — system architecture');
		});

		it("includes project info", () => {
			ctx.setProjectInfo({ name: "Flowti Plugin", domains: ["agents", "canvas"] });
			const output = ctx.serialize();
			expect(output).toContain("Project: Flowti Plugin — domains: agents, canvas");
		});

		it("includes iteration info", () => {
			ctx.setIteration({ name: "Agent World", phase: "Phase B", done: 7, total: 10 });
			const output = ctx.serialize();
			expect(output).toContain('Iteration: "Agent World" Phase B — 7/10 done');
		});

		it("includes agent roster with one agent per line", () => {
			ctx.setAgentRoster([
				{ name: "Atlas", role: "orchestration", status: "idle" },
				{ name: "Bob", role: "engineering", status: "busy", task: "Fix parser" },
			]);
			const output = ctx.serialize();
			expect(output).toContain("Team:");
			expect(output).toContain("- Atlas (orchestration — idle)");
			expect(output).toContain('- Bob (engineering — working on "Fix parser")');
		});

		it("includes persona, mood, and skills in roster", () => {
			ctx.setAgentRoster([
				{
					name: "Clara",
					role: "design",
					status: "idle",
					persona: "The Architect",
					mood: "focused",
					skills: ["UI", "CSS"],
				},
			]);
			const output = ctx.serialize();
			expect(output).toContain('- Clara "The Architect" (design, focused — idle) [UI, CSS]');
		});

		it("includes recent activity", () => {
			ctx.pushActivity('Bob started "Fix parser"');
			const output = ctx.serialize();
			expect(output).toContain("Recent:");
			expect(output).toContain('Bob started "Fix parser"');
		});
	});

	describe("getProtocolInstruction()", () => {
		it("interpolates name and domain with character instruction", () => {
			const instruction = ctx.getProtocolInstruction("Atlas", "orchestration");
			expect(instruction).toContain("You ARE Atlas, a orchestration specialist");
			expect(instruction).toContain("Stay in character at all times");
			expect(instruction).toContain("Communication rules:");
		});

		it("includes persona when provided via agent arg", () => {
			const instruction = ctx.getProtocolInstruction("Atlas", "orchestration", {
				persona: "The Coordinator",
			});
			expect(instruction).toContain("You ARE The Coordinator, a orchestration specialist");
		});

		it("includes mood, personality, skills, and roles", () => {
			const instruction = ctx.getProtocolInstruction("Atlas", "orchestration", {
				mood: "focused",
				personality: ["methodical", "calm"],
				skills: [{ name: "planning", level: "expert" }, { name: "delegation", level: "advanced" }],
				roles: ["team lead", "coordinator"],
				description: "Orchestrates team workflows",
			});
			expect(instruction).toContain("Current mood: focused.");
			expect(instruction).toContain("Personality: methodical; calm.");
			expect(instruction).toContain("Core skills: planning (expert), delegation (advanced).");
			expect(instruction).toContain("Roles: team lead, coordinator.");
			expect(instruction).toContain("Your role: Orchestrates team workflows");
		});

		it("includes scene description (defaults to hub)", () => {
			const instruction = ctx.getProtocolInstruction("Atlas", "orchestration");
			expect(instruction).toContain("You are in The Hub.");
		});

		it("includes communication rules", () => {
			const instruction = ctx.getProtocolInstruction("Atlas", "orchestration");
			expect(instruction).toContain("Keep responses SHORT");
			expect(instruction).toContain("Respond with plain text only");
			expect(instruction).toContain("Director");
		});
	});

	describe("serializeDelta()", () => {
		it("returns null when nothing changed after markSeen", () => {
			// Mark the agent as having seen everything
			ctx.markSeen("Atlas");
			const delta = ctx.serializeDelta("Atlas");
			expect(delta).toBeNull();
		});

		it("returns changes after file change", () => {
			ctx.markSeen("Atlas");
			contextProvider.fireFileChanged({
				path: "src/utils/helpers.ts",
				contentHash: "def",
				content: "export function helper() {}",
			});

			const delta = ctx.serializeDelta("Atlas");
			expect(delta).not.toBeNull();
			expect(delta).toContain("Delta for Atlas");
			expect(delta).toContain("Active file: src/utils/helpers.ts");
		});

		it("returns full snapshot when many changes accumulated", () => {
			ctx.markSeen("Atlas");

			// Push more than 10 changes to trigger fallback
			for (let i = 0; i < 12; i++) {
				ctx.pushActivity(`Activity ${i}`);
			}

			const delta = ctx.serializeDelta("Atlas");
			expect(delta).not.toBeNull();
			// Falls back to full snapshot format
			expect(delta).toContain("[World Context — Snapshot]");
		});

		it("returns all changes for agent that never called markSeen", () => {
			contextProvider.fireFileChanged({
				path: "src/main.ts",
				contentHash: "xyz",
				content: "console.log('hello');",
			});

			const delta = ctx.serializeDelta("NewAgent");
			expect(delta).not.toBeNull();
		});
	});

	describe("markSeen()", () => {
		it("advances version pointer for agent", () => {
			contextProvider.fireFileChanged({
				path: "src/foo.ts",
				contentHash: "a",
				content: "",
			});
			const vBefore = ctx.getVersion();
			expect(vBefore).toBeGreaterThan(0);

			ctx.markSeen("Atlas");

			// No new changes — delta should be null
			const delta = ctx.serializeDelta("Atlas");
			expect(delta).toBeNull();
		});

		it("tracks versions independently per agent", () => {
			ctx.markSeen("Atlas");
			ctx.markSeen("Bob");

			contextProvider.fireFileChanged({
				path: "src/bar.ts",
				contentHash: "b",
				content: "",
			});

			// Both should see the new change
			expect(ctx.serializeDelta("Atlas")).not.toBeNull();
			expect(ctx.serializeDelta("Bob")).not.toBeNull();

			// Mark only Atlas as seen
			ctx.markSeen("Atlas");
			expect(ctx.serializeDelta("Atlas")).toBeNull();
			expect(ctx.serializeDelta("Bob")).not.toBeNull();
		});
	});

	describe("onChange()", () => {
		it("fires callback on state change", () => {
			const cb = vi.fn();
			ctx.onChange(cb);

			contextProvider.fireFileChanged({
				path: "src/test.ts",
				contentHash: "t",
				content: "test",
			});

			expect(cb).toHaveBeenCalledTimes(1);
		});

		it("fires callback on mutator calls", () => {
			const cb = vi.fn();
			ctx.onChange(cb);

			ctx.setProjectInfo({ name: "Test", domains: ["a"] });
			expect(cb).toHaveBeenCalledTimes(1);

			ctx.pushActivity("Something happened");
			expect(cb).toHaveBeenCalledTimes(2);

			ctx.setIteration({ name: "v1", done: 1, total: 5 });
			expect(cb).toHaveBeenCalledTimes(3);
		});

		it("returns unsubscribe function", () => {
			const cb = vi.fn();
			const unsub = ctx.onChange(cb);

			ctx.pushActivity("First");
			expect(cb).toHaveBeenCalledTimes(1);

			unsub();
			ctx.pushActivity("Second");
			expect(cb).toHaveBeenCalledTimes(1);
		});

		it("does not propagate listener errors", () => {
			const badCb = vi.fn(() => { throw new Error("boom"); });
			const goodCb = vi.fn();

			ctx.onChange(badCb);
			ctx.onChange(goodCb);

			ctx.pushActivity("test");
			expect(badCb).toHaveBeenCalledTimes(1);
			expect(goodCb).toHaveBeenCalledTimes(1);
		});
	});

	describe("dispose()", () => {
		it("cleans up without error", () => {
			ctx.onChange(() => {});
			expect(() => ctx.dispose()).not.toThrow();
		});

		it("stops firing callbacks after dispose", () => {
			const cb = vi.fn();
			ctx.onChange(cb);

			ctx.dispose();
			ctx.pushActivity("Should not fire");
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe("debounced layout change", () => {
		it("debounces rapid layout changes", () => {
			workspace.setLeaves([{ path: "a.ts" }]);

			workspace.fireLayoutChange();
			workspace.fireLayoutChange();
			workspace.fireLayoutChange();

			// Before debounce fires
			vi.advanceTimersByTime(400);
			// iterateAllLeaves called once during constructor, but not yet from layout changes
			const callsBefore = (workspace.iterateAllLeaves as ReturnType<typeof vi.fn>).mock.calls.length;

			vi.advanceTimersByTime(200);
			const callsAfter = (workspace.iterateAllLeaves as ReturnType<typeof vi.fn>).mock.calls.length;
			expect(callsAfter).toBe(callsBefore + 1);
		});
	});

	describe("content snippet", () => {
		it("returns first 500 chars of active file content", () => {
			const longContent = "x".repeat(1000);
			contextProvider.fireFileChanged({
				path: "src/big.ts",
				contentHash: "big",
				content: longContent,
			});

			const snippet = ctx.getContentSnippet();
			expect(snippet).not.toBeNull();
			expect(snippet!.length).toBe(500);
		});

		it("returns null when no active file", () => {
			expect(ctx.getContentSnippet()).toBeNull();
		});
	});

	describe("file type mapping", () => {
		it.each([
			["file.ts", "TypeScript"],
			["file.js", "JavaScript"],
			["file.md", "Markdown"],
			["file.json", "JSON"],
			["file.css", "CSS"],
			["file.canvas", "Canvas"],
			["file.py", "Python"],
			["file.unknown", "Unknown"],
		])("maps %s to %s", (path, expectedType) => {
			contextProvider.fireFileChanged({
				path,
				contentHash: "h",
				content: "",
			});

			const output = ctx.serialize();
			expect(output).toContain(`(${expectedType})`);
		});
	});

	describe("clearActiveCanvas()", () => {
		it("removes canvas from serialized output", () => {
			ctx.setActiveCanvas({ name: "Test Canvas" });
			expect(ctx.serialize()).toContain("Canvas:");

			ctx.clearActiveCanvas();
			expect(ctx.serialize()).not.toContain("Canvas:");
		});
	});
});

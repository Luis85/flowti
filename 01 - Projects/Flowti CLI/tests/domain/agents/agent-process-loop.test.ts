import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	createAgentProcessLoop,
} from "../../../src/domain/agents/agent-process-loop.js";
import type {
	AgentProcessLoopDeps,
	ILineReader,
	ILineWriter,
} from "../../../src/domain/agents/agent-process-loop.js";
import type { IWorkerManager, SendOptions } from "../../../src/domain/agents/worker-types.js";
import type { IWorldStateManager, AgentAction } from "../../../src/domain/agents/world-state-types.js";

// ── Test helpers ─────────────────────────────────────────────────────

function createMockLineReader(): ILineReader & { simulateLine(line: string): void } {
	let callback: ((line: string) => void) | null = null;
	return {
		onLine(cb: (line: string) => void) { callback = cb; },
		close: vi.fn(),
		simulateLine(line: string) { callback?.(line); },
	};
}

function createMockLineWriter(): ILineWriter & { lines: string[] } {
	const lines: string[] = [];
	return {
		lines,
		write(line: string) { lines.push(line); },
	};
}

function createMockWorkerManager(): IWorkerManager & { lastSend: { name: string; message: string; opts?: SendOptions } | null } {
	const mgr: IWorkerManager & { lastSend: { name: string; message: string; opts?: SendOptions } | null } = {
		lastSend: null,
		spawnAll: vi.fn(),
		spawn: vi.fn(() => null),
		stop: vi.fn(),
		stopAll: vi.fn(),
		getWorker: vi.fn(() => null),
		listWorkers: vi.fn(() => []),
		send: vi.fn((name: string, message: string, opts?: SendOptions) => {
			mgr.lastSend = { name, message, opts };
		}),
		dispatchWorldEvent: vi.fn(),
	};
	return mgr;
}

function createMockWorldState(): IWorldStateManager & { emittedActions: AgentAction[] } {
	const emittedActions: AgentAction[] = [];
	return {
		emittedActions,
		emitAction: vi.fn((action: AgentAction) => { emittedActions.push(action); }),
		updateEntity: vi.fn(),
		getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
		getEntity: vi.fn(() => null),
		flush: vi.fn(),
		addActionListener: vi.fn(),
		removeActionListener: vi.fn(),
	};
}

function createMockDisk(): AgentProcessLoopDeps["disk"] & { files: Record<string, string>; dirs: Set<string> } {
	const files: Record<string, string> = {};
	const dirs = new Set<string>();
	return {
		files,
		dirs,
		readFileSync: vi.fn((p: string) => {
			if (files[p] === undefined) throw new Error(`File not found: ${p}`);
			return files[p];
		}) as AgentProcessLoopDeps["disk"]["readFileSync"],
		writeFileSync: vi.fn((p: string, c: string) => { files[p] = c; }),
		existsSync: vi.fn((p: string) => files[p] !== undefined || dirs.has(p)),
		mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
		readdirSync: vi.fn(() => []),
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn((p: string) => { delete files[p]; }),
		statSync: vi.fn(),
	} as unknown as AgentProcessLoopDeps["disk"] & { files: Record<string, string>; dirs: Set<string> };
}

function makeDeps(overrides?: Partial<AgentProcessLoopDeps>): {
	deps: AgentProcessLoopDeps;
	lineReader: ReturnType<typeof createMockLineReader>;
	lineWriter: ReturnType<typeof createMockLineWriter>;
	workerManager: ReturnType<typeof createMockWorkerManager>;
	worldState: ReturnType<typeof createMockWorldState>;
	disk: ReturnType<typeof createMockDisk>;
	exitFn: ReturnType<typeof vi.fn>;
} {
	const lineReader = createMockLineReader();
	const lineWriter = createMockLineWriter();
	const workerManager = createMockWorkerManager();
	const worldState = createMockWorldState();
	const disk = createMockDisk();
	const exitFn = vi.fn();

	const deps: AgentProcessLoopDeps = {
		workerManager,
		worldState,
		disk,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			resolve: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (_from: string, to: string) => to,
			extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
			isAbsolute: () => true,
			sep: "/",
		},
		clock: {
			iso: vi.fn(() => "2026-03-19T10:00:00.000Z"),
			safeIso: vi.fn(() => "2026-03-19T10-00-00-000Z"),
			now: vi.fn(() => new Date("2026-03-19T10:00:00.000Z")),
			ms: vi.fn(() => 1742382000000),
		},
		vaultRoot: "/vault",
		agentName: "Architect",
		pid: 12345,
		lineReader,
		lineWriter,
		exit: exitFn,
		...overrides,
	};

	return { deps, lineReader, lineWriter, workerManager, worldState, disk, exitFn };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createAgentProcessLoop", () => {
	describe("start()", () => {
		it("creates PID file in agents directory", () => {
			const { deps, disk } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			const pidPath = "/vault/.flowti/var/agents/architect.pid";
			expect(disk.files[pidPath]).toBe("12345");
		});

		it("ensures .flowti/var/agents/ directory exists", () => {
			const { deps, disk } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			expect(disk.mkdirSync).toHaveBeenCalledWith("/vault/.flowti/var/agents", { recursive: true });
		});

		it("rotates event log when it exceeds 1000 lines", () => {
			const { deps, disk } = makeDeps();
			const logPath = "/vault/.flowti/var/agents/architect-events.jsonl";
			const prevPath = "/vault/.flowti/var/agents/architect-events.prev.jsonl";
			// Populate log with 1001 lines
			const logContent = Array.from({ length: 1001 }, (_, i) => `{"line":${i}}`).join("\n");
			disk.files[logPath] = logContent;
			const handle = createAgentProcessLoop(deps);
			handle.start();
			// Should have rotated
			expect(disk.files[prevPath]).toBe(logContent);
			expect(disk.files[logPath]).toBe("");
		});

		it("does not rotate event log when under 1000 lines", () => {
			const { deps, disk } = makeDeps();
			const logPath = "/vault/.flowti/var/agents/architect-events.jsonl";
			const logContent = Array.from({ length: 50 }, (_, i) => `{"line":${i}}`).join("\n");
			disk.files[logPath] = logContent;
			const handle = createAgentProcessLoop(deps);
			handle.start();
			// Log should be unchanged, no prev file created
			expect(disk.files[logPath]).toBe(logContent);
			expect(disk.files["/vault/.flowti/var/agents/architect-events.prev.jsonl"]).toBeUndefined();
		});
	});

	describe("message input", () => {
		it("calls workerManager.send() with correct args", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "hello world" }));
			expect(workerManager.send).toHaveBeenCalledWith(
				"Architect",
				"hello world",
				expect.objectContaining({
					onEvent: expect.any(Function),
					onResponse: expect.any(Function),
				}),
			);
		});

		it("prepends context to message text when context is provided", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "do the thing", context: "You are in session 5" }));
			expect(workerManager.send).toHaveBeenCalledWith(
				"Architect",
				"You are in session 5\n\ndo the thing",
				expect.any(Object),
			);
		});

		it("does not prepend context when context is absent", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "plain msg" }));
			expect(workerManager.lastSend?.message).toBe("plain msg");
		});
	});

	describe("worker events written to stdout as JSONL", () => {
		it("writes onEvent callback output to stdout and event log", () => {
			const { deps, lineReader, lineWriter, workerManager, disk } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "go" }));

			// Grab the onEvent callback from the send call
			const sendOpts = workerManager.lastSend?.opts;
			expect(sendOpts?.onEvent).toBeDefined();

			sendOpts!.onEvent!({ kind: "thinking", text: "pondering..." });

			// Should write to stdout
			expect(lineWriter.lines.length).toBeGreaterThanOrEqual(1);
			const parsed = JSON.parse(lineWriter.lines[0].trim());
			expect(parsed.type).toBe("thinking");
			expect(parsed.agent).toBe("Architect");
			expect(parsed.text).toBe("pondering...");
			expect(typeof parsed.ts).toBe("number");

			// Should also write to event log file
			const logPath = "/vault/.flowti/var/agents/architect-events.jsonl";
			expect(disk.files[logPath]).toContain("thinking");
		});

		it("defers tool-start emission until tool-input provides richer context", () => {
			const { deps, lineReader, lineWriter, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "go" }));

			const sendOpts = workerManager.lastSend?.opts;
			sendOpts!.onEvent!({ kind: "tool-start", id: "t1", name: "Bash" });

			// tool-start alone should NOT emit — waits for tool-input
			expect(lineWriter.lines).toHaveLength(0);

			// tool-input with parseable JSON emits the enriched summary
			sendOpts!.onEvent!({ kind: "tool-input", index: 0, json: JSON.stringify({ command: "npm test" }) });
			const parsed = JSON.parse(lineWriter.lines[0].trim());
			expect(parsed.type).toBe("using-tool");
			expect(parsed.text).toBe("Running: npm test");
		});

		it("emits fallback using-tool on tool-end if tool-input never succeeded", () => {
			const { deps, lineReader, lineWriter, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "go" }));

			const sendOpts = workerManager.lastSend?.opts;
			sendOpts!.onEvent!({ kind: "tool-start", id: "t1", name: "CustomTool" });
			sendOpts!.onEvent!({ kind: "tool-input", index: 0, json: "invalid" });
			sendOpts!.onEvent!({ kind: "tool-end", id: "t1" });

			// Fallback using-tool emitted before tool-complete
			const usingTool = JSON.parse(lineWriter.lines[0].trim());
			expect(usingTool.type).toBe("using-tool");
			expect(usingTool.text).toBe("CustomTool");
			// tool-complete also emitted
			const toolComplete = JSON.parse(lineWriter.lines[1].trim());
			expect(toolComplete.type).toBe("tool-complete");
		});

		it("writes onResponse callback as response event", () => {
			const { deps, lineReader, lineWriter, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "go" }));

			const sendOpts = workerManager.lastSend?.opts;
			sendOpts!.onResponse!({ message: "Task complete.", status: "message" });

			const parsed = JSON.parse(lineWriter.lines[0].trim());
			expect(parsed.type).toBe("response");
			expect(parsed.text).toBe("Task complete.");
		});
	});

	describe("stop-generation input", () => {
		it("calls workerManager.stop() with agent name", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "stop-generation" }));
			expect(workerManager.stop).toHaveBeenCalledWith("Architect");
		});
	});

	describe("grant-permission input", () => {
		it("emits permission-granted action when decision is granted", () => {
			const { deps, lineReader, worldState } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "grant-permission", tool: "Bash", decision: "granted" }));
			expect(worldState.emitAction).toHaveBeenCalledTimes(1);
			const action = worldState.emittedActions[0];
			expect(action.type).toBe("permission-granted");
			expect(action.agentName).toBe("Architect");
			expect(action.data.tool).toBe("Bash");
		});

		it("emits permission-denied action when decision is denied", () => {
			const { deps, lineReader, worldState } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "grant-permission", tool: "Write", decision: "denied" }));
			const action = worldState.emittedActions[0];
			expect(action.type).toBe("permission-denied");
			expect(action.data.tool).toBe("Write");
		});
	});

	describe("kill input", () => {
		it("calls dispose then exit(0)", () => {
			const { deps, lineReader, exitFn, disk } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			// Verify PID file exists
			const pidPath = "/vault/.flowti/var/agents/architect.pid";
			expect(disk.files[pidPath]).toBe("12345");

			lineReader.simulateLine(JSON.stringify({ type: "kill" }));
			expect(exitFn).toHaveBeenCalledWith(0);
			// PID file should be removed by dispose
			expect(disk.unlinkSync).toHaveBeenCalledWith(pidPath);
		});
	});

	describe("dispose()", () => {
		it("removes PID file", () => {
			const { deps, disk } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			const pidPath = "/vault/.flowti/var/agents/architect.pid";
			expect(disk.files[pidPath]).toBe("12345");

			handle.dispose();
			expect(disk.unlinkSync).toHaveBeenCalledWith(pidPath);
		});

		it("closes line reader", () => {
			const { deps, lineReader } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			handle.dispose();
			expect(lineReader.close).toHaveBeenCalled();
		});

		it("is idempotent — calling dispose twice does not error", () => {
			const { deps, disk } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			handle.dispose();
			handle.dispose();
			expect(disk.unlinkSync).toHaveBeenCalledTimes(1);
		});
	});

	describe("edge cases", () => {
		it("ignores empty lines", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine("");
			lineReader.simulateLine("   ");
			expect(workerManager.send).not.toHaveBeenCalled();
		});

		it("ignores invalid JSON", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine("not json at all");
			expect(workerManager.send).not.toHaveBeenCalled();
		});

		it("ignores messages with unknown type", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ type: "unknown-type" }));
			expect(workerManager.send).not.toHaveBeenCalled();
		});

		it("ignores messages without type field", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			lineReader.simulateLine(JSON.stringify({ foo: "bar" }));
			expect(workerManager.send).not.toHaveBeenCalled();
		});

		it("ignores messages after dispose", () => {
			const { deps, lineReader, workerManager } = makeDeps();
			const handle = createAgentProcessLoop(deps);
			handle.start();
			handle.dispose();
			lineReader.simulateLine(JSON.stringify({ type: "message", text: "too late" }));
			expect(workerManager.send).not.toHaveBeenCalled();
		});

		it("slugifies agent name for file paths", () => {
			const { deps, disk } = makeDeps({ agentName: "Lead Developer" });
			const handle = createAgentProcessLoop(deps);
			handle.start();
			expect(disk.files["/vault/.flowti/var/agents/lead-developer.pid"]).toBe("12345");
		});
	});
});

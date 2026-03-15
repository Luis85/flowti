import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { ChatShell } from "../../../src/ui/menus/chat-shell.js";
import type { ChatShellDeps } from "../../../src/ui/menus/chat-shell.js";
import type { IChatRenderer, ChatConfig, ChatMessage, ChatTurn, ChatCommand } from "../../../src/infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";

// ── Mock renderer ─────────────────────────────────────────────────────

function createMockRenderer(): IChatRenderer & {
	_messages: ChatMessage[];
	_events: AgentStreamEvent[];
	_statuses: string[];
	_modes: string[];
	_mountConfig: ChatConfig | null;
	_history: { summary: string; turns: readonly ChatTurn[] }[];
	_userInputCb: ((text: string) => void) | null;
	_commandCb: ((cmd: ChatCommand) => void) | null;
} {
	const messages: ChatMessage[] = [];
	const events: AgentStreamEvent[] = [];
	const statuses: string[] = [];
	const modes: string[] = [];
	const history: { summary: string; turns: readonly ChatTurn[] }[] = [];
	let mountConfig: ChatConfig | null = null;
	let userInputCb: ((text: string) => void) | null = null;
	let commandCb: ((cmd: ChatCommand) => void) | null = null;

	return {
		get _messages() { return messages; },
		get _events() { return events; },
		get _statuses() { return statuses; },
		get _modes() { return modes; },
		get _mountConfig() { return mountConfig; },
		get _history() { return history; },
		get _userInputCb() { return userInputCb; },
		get _commandCb() { return commandCb; },

		mount: vi.fn(async (config: ChatConfig) => { mountConfig = config; }),
		unmount: vi.fn(async () => undefined),

		pushMessage: vi.fn((msg: ChatMessage) => { messages.push(msg); }),
		pushStreamEvent: vi.fn((event: AgentStreamEvent) => { events.push(event); }),
		updateStatus: vi.fn((status: string) => { statuses.push(status); }),
		updateMode: vi.fn((mode: string) => { modes.push(mode); }),
		showHistory: vi.fn((summary: string, turns: readonly ChatTurn[]) => { history.push({ summary, turns }); }),

		onUserInput: vi.fn((cb: (text: string) => void) => { userInputCb = cb; }),
		onCommand: vi.fn((cb: (cmd: ChatCommand) => void) => { commandCb = cb; }),
	};
}

// ── Mock deps ─────────────────────────────────────────────────────────

function makeDeps(): ChatShellDeps {
	return {
		disk: {
			existsSync: vi.fn(() => false),
			readFileSync: vi.fn(() => ""),
			writeFileSync: vi.fn(),
			mkdirSync: vi.fn(),
		} as unknown as ChatShellDeps["disk"],
		paths: {
			join: vi.fn((...a: string[]) => a.join("/")),
			resolve: vi.fn((...a: string[]) => a.join("/")),
			dirname: vi.fn(() => "."),
		} as unknown as ChatShellDeps["paths"],
		clock: {
			ms: vi.fn(() => 1234),
			iso: vi.fn(() => "2026-03-15T12:00:00Z"),
			now: vi.fn(() => new Date()),
			safeIso: vi.fn(() => "2026-03-15T12-00-00Z"),
		} as unknown as ChatShellDeps["clock"],
		shell: {
			check: vi.fn(() => true),
		} as unknown as ChatShellDeps["shell"],
		log: vi.fn(),
		processRunner: {
			spawn: vi.fn(() => ({
				onEvent: vi.fn(() => () => {}),
				result: Promise.resolve({ text: '{"message":"Hello","status":"message"}', thinking: "", exitCode: 0 }),
				kill: vi.fn(),
			})),
		},
	};
}

function makeAgent(): AgentSummary {
	return {
		name: "Dev",
		agentType: "ai",
		description: "A developer agent",
		domain: "development",
		skills: [],
		tools: [],
		roles: [],
		persona: "Alice",
		file: "dev.md",
	};
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────

describe("ChatShell.start", () => {
	it("mounts the renderer with correct agentName and persona", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		// start() returns a promise that resolves on exit; drive it to completion via /done
		const startPromise = shell.start();
		// Allow microtasks to settle so mount() is called
		await Promise.resolve();
		await Promise.resolve();

		expect(renderer.mount).toHaveBeenCalledWith(
			expect.objectContaining({ agentName: "Dev", persona: "Alice", mode: "conversation" }),
		);

		// Trigger exit to resolve startPromise
		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("registers onUserInput and onCommand callbacks", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		expect(renderer.onUserInput).toHaveBeenCalled();
		expect(renderer.onCommand).toHaveBeenCalled();

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("shows history when active thread exists", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		// Seed existing conversation data
		const storedConversation = {
			agent: "Dev",
			activeThread: "t1",
			threads: [{
				id: "t1",
				startedAt: "2026-03-15T12:00:00Z",
				lastActivity: "2026-03-15T12:00:00Z",
				turns: [
					{ role: "user" as const, content: "hello", ts: "2026-03-15T12:00:00Z" },
					{ role: "agent" as const, content: "hi there", ts: "2026-03-15T12:00:00Z" },
				],
			}],
		};
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(storedConversation));

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		expect(renderer.showHistory).toHaveBeenCalledWith(
			"Resuming conversation",
			expect.arrayContaining([expect.objectContaining({ role: "user", content: "hello" })]),
		);

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleCommand — /done", () => {
	it("kills active process if running and unmounts", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const mockKill = vi.fn();
		const mockProcess = {
			onEvent: vi.fn(() => () => {}),
			result: new Promise(() => {}), // never resolves
			kill: mockKill,
		};
		(deps.processRunner.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProcess);

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		// Fire user input to spawn a process (doesn't await result)
		renderer._userInputCb?.("do something");
		// Let the spawn call happen
		await Promise.resolve();
		await Promise.resolve();

		// Now send /done — should kill the active process
		renderer._commandCb?.({ type: "done" });
		await startPromise;

		expect(mockKill).toHaveBeenCalled();
		expect(renderer.unmount).toHaveBeenCalled();
	});

	it("unmounts without killing when no process is active", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._commandCb?.({ type: "done" });
		await startPromise;

		expect(renderer.unmount).toHaveBeenCalled();
	});
});

describe("ChatShell.handleCommand — /back", () => {
	it("unmounts and resolves start promise", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._commandCb?.({ type: "back" });
		await startPromise;

		expect(renderer.unmount).toHaveBeenCalled();
	});
});

describe("ChatShell.handleCommand — /let-go", () => {
	it("unmounts without killing active process", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const mockKill = vi.fn();
		const mockProcess = {
			onEvent: vi.fn(() => () => {}),
			result: new Promise(() => {}),
			kill: mockKill,
		};
		(deps.processRunner.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProcess);

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		// Trigger user input to create an active process
		renderer._userInputCb?.("work on something");
		await Promise.resolve();
		await Promise.resolve();

		// /let-go should detach without killing
		renderer._commandCb?.({ type: "let-go" });
		await startPromise;

		expect(mockKill).not.toHaveBeenCalled();
		expect(renderer.unmount).toHaveBeenCalled();
	});
});

describe("ChatShell.handleCommand — /new", () => {
	it("creates a new thread and clears history display", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._commandCb?.({ type: "new" });
		await Promise.resolve();

		expect(renderer.showHistory).toHaveBeenCalledWith("New conversation started", []);
		expect(deps.disk.writeFileSync).toHaveBeenCalled();

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleCommand — /talk and /focus", () => {
	it("/talk switches renderer to conversation mode", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._commandCb?.({ type: "talk" });
		expect(renderer.updateMode).toHaveBeenCalledWith("conversation");

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("/focus switches renderer to task mode", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._commandCb?.({ type: "focus" });
		expect(renderer.updateMode).toHaveBeenCalledWith("task");

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleUserInput", () => {
	it("spawns process via processRunner and pushes agent message", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("hello agent");
		// Flush the async chain
		await new Promise((r) => setTimeout(r, 0));

		expect(deps.processRunner.spawn).toHaveBeenCalled();
		expect(renderer.pushMessage).toHaveBeenCalledWith(
			expect.objectContaining({ role: "agent", content: "Hello" }),
		);

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("forwards stream events to renderer", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		let capturedEventCb: ((event: AgentStreamEvent) => void) | null = null;
		(deps.processRunner.spawn as ReturnType<typeof vi.fn>).mockReturnValue({
			onEvent: vi.fn((cb: (event: AgentStreamEvent) => void) => {
				capturedEventCb = cb;
				return () => {};
			}),
			result: Promise.resolve({ text: '{"message":"Hi","status":"message"}', thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		});

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("test");
		await Promise.resolve();

		// Simulate a stream event
		capturedEventCb?.({ kind: "text", text: "partial..." });

		expect(renderer.pushStreamEvent).toHaveBeenCalledWith({ kind: "text", text: "partial..." });

		await new Promise((r) => setTimeout(r, 0));
		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("ignores empty input", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("   ");
		expect(deps.processRunner.spawn).not.toHaveBeenCalled();

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("persists conversation after response", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("persist me");
		await new Promise((r) => setTimeout(r, 0));

		expect(deps.disk.writeFileSync).toHaveBeenCalled();

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleStreamEvent — mode switching", () => {
	it("switches to task mode after 2 tool-start events", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		let capturedEventCb: ((event: AgentStreamEvent) => void) | null = null;
		(deps.processRunner.spawn as ReturnType<typeof vi.fn>).mockReturnValue({
			onEvent: vi.fn((cb: (event: AgentStreamEvent) => void) => {
				capturedEventCb = cb;
				return () => {};
			}),
			result: Promise.resolve({ text: '{"message":"done","status":"message"}', thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		});

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("do tasks");
		await Promise.resolve();

		// Fire two tool-start events
		capturedEventCb?.({ kind: "tool-start", id: "t1", name: "bash" });
		capturedEventCb?.({ kind: "tool-start", id: "t2", name: "read" });

		expect(renderer.updateMode).toHaveBeenCalledWith("task");

		await new Promise((r) => setTimeout(r, 0));
		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("does NOT switch to task mode after only one tool-start", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		let capturedEventCb: ((event: AgentStreamEvent) => void) | null = null;
		(deps.processRunner.spawn as ReturnType<typeof vi.fn>).mockReturnValue({
			onEvent: vi.fn((cb: (event: AgentStreamEvent) => void) => {
				capturedEventCb = cb;
				return () => {};
			}),
			result: Promise.resolve({ text: '{"message":"done","status":"message"}', thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		});

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("do a task");
		await Promise.resolve();

		capturedEventCb?.({ kind: "tool-start", id: "t1", name: "bash" });

		// updateMode should NOT have been called with "task" at this point
		const taskModeCalls = (renderer.updateMode as ReturnType<typeof vi.fn>).mock.calls.filter(
			(call: unknown[]) => call[0] === "task",
		);
		expect(taskModeCalls).toHaveLength(0);

		await new Promise((r) => setTimeout(r, 0));
		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("updates status to error on error events", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		let capturedEventCb: ((event: AgentStreamEvent) => void) | null = null;
		(deps.processRunner.spawn as ReturnType<typeof vi.fn>).mockReturnValue({
			onEvent: vi.fn((cb: (event: AgentStreamEvent) => void) => {
				capturedEventCb = cb;
				return () => {};
			}),
			result: Promise.resolve({ text: '{"message":"oops","status":"error"}', thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		});

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._userInputCb?.("trigger error");
		await Promise.resolve();

		capturedEventCb?.({ kind: "error", message: "Something went wrong" });

		expect(renderer.updateStatus).toHaveBeenCalledWith("error");

		await new Promise((r) => setTimeout(r, 0));
		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleCommand — /history", () => {
	it("loads and shows full thread history (up to 100 turns)", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		const storedConversation = {
			agent: "Dev",
			activeThread: "t1",
			threads: [{
				id: "t1",
				startedAt: "2026-03-15T12:00:00Z",
				lastActivity: "2026-03-15T12:00:00Z",
				turns: [
					{ role: "user" as const, content: "q1", ts: "2026-03-15T12:00:00Z" },
					{ role: "agent" as const, content: "a1", ts: "2026-03-15T12:00:00Z" },
				],
			}],
		};
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(storedConversation));

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		// Clear the initial showHistory call from mount
		(renderer.showHistory as ReturnType<typeof vi.fn>).mockClear();

		renderer._commandCb?.({ type: "history" });
		await Promise.resolve();

		expect(renderer.showHistory).toHaveBeenCalledWith(
			"Conversation history",
			expect.arrayContaining([expect.objectContaining({ role: "user" })]),
		);

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleCommand — /topics", () => {
	it("logs thread IDs via deps.log", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		const storedConversation = {
			agent: "Dev",
			activeThread: "t1",
			threads: [
				{ id: "t1", startedAt: "", lastActivity: "", turns: [] },
				{ id: "t2", startedAt: "", lastActivity: "", turns: [] },
			],
		};
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(storedConversation));

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		renderer._commandCb?.({ type: "topics" });

		expect(deps.log).toHaveBeenCalledWith("t1");
		expect(deps.log).toHaveBeenCalledWith("t2");

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

describe("ChatShell.handleCommand — /pick", () => {
	it("switches active thread and reloads history", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();

		const storedConversation = {
			agent: "Dev",
			activeThread: "t1",
			threads: [
				{ id: "t1", startedAt: "", lastActivity: "", turns: [{ role: "user" as const, content: "from t1", ts: "2026-03-15T12:00:00Z" }] },
				{ id: "t2", startedAt: "", lastActivity: "", turns: [{ role: "user" as const, content: "from t2", ts: "2026-03-15T12:00:00Z" }] },
			],
		};
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(storedConversation));

		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");
		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		(renderer.showHistory as ReturnType<typeof vi.fn>).mockClear();

		renderer._commandCb?.({ type: "pick", name: "t2" });
		await Promise.resolve();

		expect(renderer.showHistory).toHaveBeenCalledWith(
			"Switched to: t2",
			expect.arrayContaining([expect.objectContaining({ content: "from t2" })]),
		);

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});

	it("does nothing for an unknown thread name", async () => {
		const renderer = createMockRenderer();
		const deps = makeDeps();
		const shell = new ChatShell(renderer, makeAgent(), deps, "/vault", "/project");

		const startPromise = shell.start();
		await Promise.resolve();
		await Promise.resolve();

		(renderer.showHistory as ReturnType<typeof vi.fn>).mockClear();
		renderer._commandCb?.({ type: "pick", name: "nonexistent" });
		await Promise.resolve();

		expect(renderer.showHistory).not.toHaveBeenCalled();

		renderer._commandCb?.({ type: "done" });
		await startPromise;
	});
});

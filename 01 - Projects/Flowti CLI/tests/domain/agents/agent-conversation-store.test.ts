import { describe, it, expect, vi } from "vitest";
import {
	loadConversation, saveConversation, createThread, appendTurn, getActiveHistory,
	type ConversationFile, type ConversationTurn, type ConversationStoreDeps,
} from "../../../src/domain/agents/agent-conversation-store.js";

function makeDeps(files: Record<string, string> = {}): ConversationStoreDeps {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
			unlinkSync: vi.fn(),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
			statSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			resolve: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop()!,
			relative: (_from: string, to: string) => to,
			extname: (p: string) => "." + p.split(".").pop()!,
			isAbsolute: () => true,
			sep: "/",
		},
	} as unknown as ConversationStoreDeps;
}

function makeTurn(role: "user" | "agent", content: string, ts = "2026-01-01T00:00:00.000Z"): ConversationTurn {
	return { role, content, ts };
}

describe("loadConversation", () => {
	it("returns empty default when file doesn't exist", () => {
		const deps = makeDeps();
		const result = loadConversation(deps, "/var", "Bob");
		expect(result).toEqual({ agent: "Bob", threads: [], activeThread: null });
	});

	it("returns parsed data when file exists", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:01:00.000Z", turns: [] }],
			activeThread: "t1",
		};
		const deps = makeDeps({ "/var/conversations/bob.json": JSON.stringify(data) });
		const result = loadConversation(deps, "/var", "Bob");
		expect(result).toEqual(data);
	});

	it("slugifies agent name for file path", () => {
		const data: ConversationFile = { agent: "My Agent", threads: [], activeThread: null };
		const deps = makeDeps({ "/var/conversations/my-agent.json": JSON.stringify(data) });
		const result = loadConversation(deps, "/var", "My Agent");
		expect(result).toEqual(data);
	});

	it("returns empty default on corrupt JSON", () => {
		const deps = makeDeps({ "/var/conversations/bob.json": "{ not valid json" });
		const result = loadConversation(deps, "/var", "Bob");
		expect(result).toEqual({ agent: "Bob", threads: [], activeThread: null });
	});
});

describe("saveConversation", () => {
	it("writes JSON to correct path", () => {
		const deps = makeDeps({ "/var/conversations": "" });
		const data: ConversationFile = { agent: "Bob", threads: [], activeThread: null };
		saveConversation(deps, "/var", "Bob", data);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/var/conversations/bob.json",
			JSON.stringify(data, null, "\t"),
			"utf-8",
		);
	});

	it("calls mkdirSync when conversations dir doesn't exist", () => {
		const deps = makeDeps();
		const data: ConversationFile = { agent: "Bob", threads: [], activeThread: null };
		saveConversation(deps, "/var", "Bob", data);
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith("/var/conversations", { recursive: true });
	});

	it("does not call mkdirSync when conversations dir already exists", () => {
		const deps = makeDeps({ "/var/conversations": "" });
		const data: ConversationFile = { agent: "Bob", threads: [], activeThread: null };
		saveConversation(deps, "/var", "Bob", data);
		expect(deps.disk.mkdirSync).not.toHaveBeenCalled();
	});

	it("slugifies agent name in file path", () => {
		const deps = makeDeps({ "/var/conversations": "" });
		const data: ConversationFile = { agent: "My Agent", threads: [], activeThread: null };
		saveConversation(deps, "/var", "My Agent", data);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/var/conversations/my-agent.json",
			expect.any(String),
			"utf-8",
		);
	});
});

describe("createThread", () => {
	it("creates a new thread with empty turns", () => {
		const data: ConversationFile = { agent: "Bob", threads: [], activeThread: null };
		const result = createThread(data, "t1", "2026-01-01T00:00:00.000Z");
		expect(result.threads).toHaveLength(1);
		expect(result.threads[0]).toEqual({
			id: "t1",
			startedAt: "2026-01-01T00:00:00.000Z",
			lastActivity: "2026-01-01T00:00:00.000Z",
			turns: [],
		});
	});

	it("sets activeThread to new thread id", () => {
		const data: ConversationFile = { agent: "Bob", threads: [], activeThread: null };
		const result = createThread(data, "t1", "2026-01-01T00:00:00.000Z");
		expect(result.activeThread).toBe("t1");
	});

	it("preserves existing threads", () => {
		const existing: ConversationThread = {
			id: "t0",
			startedAt: "2025-12-31T00:00:00.000Z",
			lastActivity: "2025-12-31T00:00:00.000Z",
			turns: [],
		};
		const data: ConversationFile = { agent: "Bob", threads: [existing], activeThread: "t0" };
		const result = createThread(data, "t1", "2026-01-01T00:00:00.000Z");
		expect(result.threads).toHaveLength(2);
		expect(result.threads[0]).toEqual(existing);
	});
});

// Need to import ConversationThread type for the test above
import type { ConversationThread } from "../../../src/domain/agents/agent-conversation-store.js";

describe("appendTurn", () => {
	it("adds turn to active thread", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] }],
			activeThread: "t1",
		};
		const turn = makeTurn("user", "Hello", "2026-01-01T00:01:00.000Z");
		const result = appendTurn(data, turn);
		expect(result.threads[0].turns).toHaveLength(1);
		expect(result.threads[0].turns[0]).toEqual(turn);
	});

	it("updates lastActivity to turn timestamp", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] }],
			activeThread: "t1",
		};
		const turn = makeTurn("agent", "Hi there", "2026-01-01T00:02:00.000Z");
		const result = appendTurn(data, turn);
		expect(result.threads[0].lastActivity).toBe("2026-01-01T00:02:00.000Z");
	});

	it("returns unchanged data when no activeThread", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] }],
			activeThread: null,
		};
		const turn = makeTurn("user", "Hello");
		const result = appendTurn(data, turn);
		expect(result).toBe(data);
	});

	it("does not modify non-active threads", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [
				{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] },
				{ id: "t2", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] },
			],
			activeThread: "t1",
		};
		const turn = makeTurn("user", "Hello", "2026-01-01T00:01:00.000Z");
		const result = appendTurn(data, turn);
		expect(result.threads[1].turns).toHaveLength(0);
		expect(result.threads[1].lastActivity).toBe("2026-01-01T00:00:00.000Z");
	});
});

describe("getActiveHistory", () => {
	function makeThreadData(turnCount: number): ConversationFile {
		const turns: ConversationTurn[] = Array.from({ length: turnCount }, (_, i) =>
			makeTurn(i % 2 === 0 ? "user" : "agent", `Message ${i}`, `2026-01-01T00:${String(i).padStart(2, "0")}:00.000Z`),
		);
		return {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns }],
			activeThread: "t1",
		};
	}

	it("returns all turns when fewer than maxTurns", () => {
		const data = makeThreadData(5);
		const result = getActiveHistory(data, 20);
		expect(result).toHaveLength(5);
	});

	it("returns last N turns when more than maxTurns", () => {
		const data = makeThreadData(30);
		const result = getActiveHistory(data, 10);
		expect(result).toHaveLength(10);
		expect(result[0].content).toBe("Message 20");
		expect(result[9].content).toBe("Message 29");
	});

	it("caps at default maxTurns of 20", () => {
		const data = makeThreadData(25);
		const result = getActiveHistory(data);
		expect(result).toHaveLength(20);
		expect(result[0].content).toBe("Message 5");
	});

	it("returns empty when no activeThread", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] }],
			activeThread: null,
		};
		expect(getActiveHistory(data)).toEqual([]);
	});

	it("returns empty when activeThread points to non-existent id", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] }],
			activeThread: "nonexistent",
		};
		expect(getActiveHistory(data)).toEqual([]);
	});

	it("returns empty array when thread has no turns", () => {
		const data: ConversationFile = {
			agent: "Bob",
			threads: [{ id: "t1", startedAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-01-01T00:00:00.000Z", turns: [] }],
			activeThread: "t1",
		};
		expect(getActiveHistory(data)).toEqual([]);
	});
});

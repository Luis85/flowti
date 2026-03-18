import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { resolveMimeType, handleRequest, parseJsonBody, handleSseConnection, handleApiRoute } from "../../../src/domain/serve/static-server.js";
import type { ServerContext } from "../../../src/domain/serve/static-server.js";
import type { IFileSystem, IPaths } from "../../../src/infrastructure/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";

// ── Helpers ──────────────────────────────────────────────────────────

const mockPaths: Pick<IPaths, "extname" | "join"> = {
	extname: (p: string) => {
		const dot = p.lastIndexOf(".");
		return dot === -1 ? "" : p.slice(dot);
	},
	join: (...parts: string[]) => parts.join("/"),
};

function mockDisk(files: Record<string, string>): Pick<IFileSystem, "existsSync" | "readFileSync"> {
	return {
		existsSync: (p: string) => p in files,
		readFileSync: (p: string) => files[p] ?? "",
	};
}

// ── MIME resolution ──────────────────────────────────────────────────

describe("resolveMimeType", () => {
	it("resolves .html to text/html", () => {
		expect(resolveMimeType("page.html", mockPaths as IPaths)).toBe("text/html; charset=utf-8");
	});

	it("resolves .css to text/css", () => {
		expect(resolveMimeType("style.css", mockPaths as IPaths)).toBe("text/css; charset=utf-8");
	});

	it("resolves .js to application/javascript", () => {
		expect(resolveMimeType("app.js", mockPaths as IPaths)).toBe("application/javascript; charset=utf-8");
	});

	it("resolves .json to application/json", () => {
		expect(resolveMimeType("data.json", mockPaths as IPaths)).toBe("application/json; charset=utf-8");
	});

	it("resolves .png to image/png", () => {
		expect(resolveMimeType("icon.png", mockPaths as IPaths)).toBe("image/png");
	});

	it("resolves .svg to image/svg+xml", () => {
		expect(resolveMimeType("logo.svg", mockPaths as IPaths)).toBe("image/svg+xml");
	});

	it("resolves .woff2 to font/woff2", () => {
		expect(resolveMimeType("font.woff2", mockPaths as IPaths)).toBe("font/woff2");
	});

	it("returns octet-stream for unknown extensions", () => {
		expect(resolveMimeType("file.xyz", mockPaths as IPaths)).toBe("application/octet-stream");
	});

	it("is case-insensitive for extensions", () => {
		expect(resolveMimeType("page.HTML", mockPaths as IPaths)).toBe("text/html; charset=utf-8");
	});
});

// ── Request handling ─────────────────────────────────────────────────

describe("handleRequest", () => {
	const root = "/site";
	const files: Record<string, string> = {
		"/site/index.html": "<html>Home</html>",
		"/site/about.html": "<html>About</html>",
		"/site/css/style.css": "body { color: red; }",
		"/site/data/info.json": '{"ok":true}',
	};
	const deps = { disk: mockDisk(files), paths: mockPaths as IPaths };

	it("serves index.html for root path", () => {
		const result = handleRequest("/", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.contentType).toBe("text/html; charset=utf-8");
		expect(result.body).toBe("<html>Home</html>");
	});

	it("serves index.html for empty path", () => {
		const result = handleRequest("", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe("<html>Home</html>");
	});

	it("serves a specific file", () => {
		const result = handleRequest("/about.html", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.contentType).toBe("text/html; charset=utf-8");
		expect(result.body).toBe("<html>About</html>");
	});

	it("serves nested files", () => {
		const result = handleRequest("/css/style.css", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.contentType).toBe("text/css; charset=utf-8");
		expect(result.body).toBe("body { color: red; }");
	});

	it("returns 404 for missing files", () => {
		const result = handleRequest("/missing.html", root, deps);
		expect(result.statusCode).toBe(404);
		expect(result.contentType).toBe("text/plain; charset=utf-8");
		expect(result.body).toBe("404 Not Found");
	});

	it("strips query strings from URL", () => {
		const result = handleRequest("/about.html?v=123", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe("<html>About</html>");
	});

	it("prevents directory traversal with ..", () => {
		const result = handleRequest("/../../../etc/passwd", root, deps);
		expect(result.statusCode).toBe(404);
	});

	it("prevents directory traversal with encoded ..", () => {
		const result = handleRequest("/%2e%2e/%2e%2e/etc/passwd", root, deps);
		expect(result.statusCode).toBe(404);
	});

	it("normalizes backslashes", () => {
		const result = handleRequest("/css\\style.css", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe("body { color: red; }");
	});

	it("serves JSON files with correct MIME type", () => {
		const result = handleRequest("/data/info.json", root, deps);
		expect(result.statusCode).toBe(200);
		expect(result.contentType).toBe("application/json; charset=utf-8");
	});
});

// ── parseJsonBody ───────────────────────────────────────────────────

function fakeIncoming(body: string): IncomingMessage {
	const emitter = new EventEmitter() as unknown as IncomingMessage;
	setTimeout(() => {
		if (body) emitter.emit("data", Buffer.from(body));
		emitter.emit("end");
	}, 0);
	return emitter;
}

describe("parseJsonBody", () => {
	it("parses valid JSON", async () => {
		const result = await parseJsonBody(fakeIncoming('{"key":"value"}'));
		expect(result).toEqual({ key: "value" });
	});

	it("rejects invalid JSON", async () => {
		await expect(parseJsonBody(fakeIncoming("not json"))).rejects.toThrow("Invalid JSON");
	});

	it("parses empty object from empty body", async () => {
		const emitter = new EventEmitter() as unknown as IncomingMessage;
		setTimeout(() => {
			emitter.emit("data", Buffer.from("{}"));
			emitter.emit("end");
		}, 0);
		const result = await parseJsonBody(emitter);
		expect(result).toEqual({});
	});
});

// ── handleSseConnection ─────────────────────────────────────────────

interface FakeRes {
	res: ServerResponse;
	state: { written: string; headers: Record<string, unknown>; statusCode: number };
}

function fakeResponse(): FakeRes {
	const state = { written: "", headers: {} as Record<string, unknown>, statusCode: 0 };
	const emitter = new EventEmitter();
	const res = Object.assign(emitter, {
		writeHead: (code: number, hdrs?: Record<string, string>) => { state.statusCode = code; if (hdrs) state.headers = hdrs; },
		write: (data: string) => { state.written += data; return true; },
		end: (data?: string) => { if (data) state.written += data; },
	}) as unknown as ServerResponse;
	return { res, state };
}

function fakeContext(overrides: Partial<ServerContext> = {}): ServerContext {
	return {
		worldState: {
			emitAction: vi.fn(),
			updateEntity: vi.fn(),
			getState: vi.fn(),
			getEntity: vi.fn().mockReturnValue(null),
			flush: vi.fn(),
			addActionListener: vi.fn(),
			removeActionListener: vi.fn(),
		},
		workerManager: {
			spawnAll: vi.fn(),
			spawn: vi.fn(),
			stop: vi.fn(),
			stopAll: vi.fn(),
			getWorker: vi.fn(),
			listWorkers: vi.fn(),
			send: vi.fn(),
			dispatchWorldEvent: vi.fn(),
		},
		deps: {
			disk: mockDisk({}) as IFileSystem,
			paths: mockPaths as IPaths,
			clock: { now: () => new Date("2026-01-01T00:00:00Z"), iso: () => "2026-01-01T00:00:00.000Z" },
		},
		sseClients: new Set(),
		vaultRoot: "/vault",
		projectsDir: "/projects",
		startedAt: Date.now(),
		...overrides,
	};
}

describe("handleSseConnection", () => {
	it("sends SSE headers and registers client", () => {
		const ctx = fakeContext();
		const { res, state } = fakeResponse();
		handleSseConnection(res, ctx);
		expect(state.statusCode).toBe(200);
		expect(state.headers["Content-Type"]).toBe("text/event-stream");
		expect(state.written).toContain("event: connected");
		expect(ctx.sseClients.has(res)).toBe(true);
	});

	it("removes client on close", () => {
		const ctx = fakeContext();
		const { res } = fakeResponse();
		handleSseConnection(res, ctx);
		expect(ctx.sseClients.size).toBe(1);
		res.emit("close");
		expect(ctx.sseClients.size).toBe(0);
	});
});

// ── handleApiRoute ──────────────────────────────────────────────────

function fakeReq(method: string, url: string, body?: string): IncomingMessage {
	const emitter = new EventEmitter() as unknown as IncomingMessage;
	(emitter as unknown as Record<string, string>).method = method;
	(emitter as unknown as Record<string, string>).url = url;
	if (body !== undefined) {
		setTimeout(() => {
			emitter.emit("data", Buffer.from(body));
			emitter.emit("end");
		}, 0);
	}
	return emitter;
}

describe("handleApiRoute", () => {
	it("returns 404 for unknown routes", async () => {
		const ctx = fakeContext();
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("GET", "/api/unknown"), res, "/api/unknown", ctx);
		const parsed = JSON.parse(state.written);
		expect(parsed).toEqual({ error: "Not found" });
	});

	it("returns world-state file when it exists", async () => {
		const worldJson = '{"version":1,"entities":{}}';
		const wsFiles: Record<string, string> = { "/vault/.flowti/var/world-state.json": worldJson };
		const ctx = fakeContext({
			deps: {
				disk: mockDisk(wsFiles) as IFileSystem,
				paths: mockPaths as IPaths,
				clock: { now: () => new Date(), iso: () => "2026-01-01T00:00:00.000Z" },
			},
		});
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("GET", "/api/world-state"), res, "/api/world-state", ctx);
		expect(state.statusCode).toBe(200);
		expect(state.written).toBe(worldJson);
	});

	it("returns 404 when world-state file does not exist", async () => {
		const ctx = fakeContext();
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("GET", "/api/world-state"), res, "/api/world-state", ctx);
		const parsed = JSON.parse(state.written);
		expect(parsed).toEqual({ error: "No world state" });
	});

	it("returns agent entity when found", async () => {
		const entity = { id: "alice", type: "agent" as const, components: { position: { x: 1, y: 2 } } };
		const ctx = fakeContext();
		(ctx.worldState.getEntity as ReturnType<typeof vi.fn>).mockReturnValue(entity);
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("GET", "/api/agent/alice"), res, "/api/agent/alice", ctx);
		const parsed = JSON.parse(state.written);
		expect(parsed).toEqual(entity);
	});

	it("returns 404 when agent not found", async () => {
		const ctx = fakeContext();
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("GET", "/api/agent/bob"), res, "/api/agent/bob", ctx);
		expect(state.statusCode).toBe(404);
		expect(JSON.parse(state.written)).toEqual({ error: "Agent not found" });
	});

	it("handles /events GET by establishing SSE", async () => {
		const ctx = fakeContext();
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("GET", "/events"), res, "/events", ctx);
		expect(state.statusCode).toBe(200);
		expect(state.headers["Content-Type"]).toBe("text/event-stream");
		expect(ctx.sseClients.has(res)).toBe(true);
	});

	it("POST /api/agent/send spawns worker if getWorker returns null", async () => {
		const ctx = fakeContext();
		(ctx.workerManager.getWorker as ReturnType<typeof vi.fn>).mockReturnValue(null);
		(ctx.workerManager.spawn as ReturnType<typeof vi.fn>).mockReturnValue({ name: "NewAgent", state: "idle" });
		const { res } = fakeResponse();
		await handleApiRoute(fakeReq("POST", "/api/agent/send", JSON.stringify({ agentName: "NewAgent", message: "Hi" })), res, "/api/agent/send", ctx);
		expect(ctx.workerManager.spawn).toHaveBeenCalledWith("NewAgent");
		expect(ctx.workerManager.send).toHaveBeenCalled();
	});

	it("POST /api/agent/send returns 404 if agent cannot be spawned", async () => {
		const ctx = fakeContext();
		(ctx.workerManager.getWorker as ReturnType<typeof vi.fn>).mockReturnValue(null);
		(ctx.workerManager.spawn as ReturnType<typeof vi.fn>).mockReturnValue(null);
		const { res, state } = fakeResponse();
		await handleApiRoute(fakeReq("POST", "/api/agent/send", JSON.stringify({ agentName: "Unknown", message: "Hi" })), res, "/api/agent/send", ctx);
		expect(state.statusCode).toBe(404);
	});
});

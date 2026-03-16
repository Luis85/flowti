/**
 * static-server.ts — Zero-dependency HTTP static file server.
 *
 * Uses Node built-in `http` and `fs` modules. Serves files from a configurable
 * root directory with proper MIME types and 404 handling. Also provides an API
 * routing layer and SSE for the agent RPG environment.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { IFileSystem, IShell, IPaths } from "../../infrastructure/types.js";
import type { IWorldStateManager } from "../agents/world-state-types.js";
import type { IWorkerManager, SendOptions } from "../agents/worker-types.js";

// ── Server context (for API + SSE routes) ────────────────────────────

export interface ServerContext {
	readonly worldState: IWorldStateManager;
	readonly workerManager: IWorkerManager;
	readonly deps: { readonly disk: IFileSystem; readonly paths: IPaths; readonly clock: { now(): Date; iso(): string } };
	readonly sseClients: Set<ServerResponse>;
	readonly vaultRoot: string;
}

export interface ServerOptions {
	readonly port: number;
	readonly dir: string;
}

export interface ServerHandle {
	readonly url: string;
	close(): void;
}

export interface ServeDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly shell: IShell;
	readonly log: (msg: string) => void;
}

// ── MIME types ──────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".htm": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".map": "application/json; charset=utf-8",
};

const DEFAULT_MIME = "application/octet-stream";

/** Resolve MIME type from file extension. */
export function resolveMimeType(filePath: string, paths: IPaths): string {
	const ext = paths.extname(filePath).toLowerCase();
	return MIME_TYPES[ext] ?? DEFAULT_MIME;
}

// ── Request handler ─────────────────────────────────────────────────

export interface ServeResult {
	readonly statusCode: number;
	readonly contentType: string;
	readonly body: string | Buffer;
}

const BINARY_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/x-icon", "font/woff", "font/woff2", "font/ttf", "application/octet-stream"]);

/** Handle a single request. Returns status, content type, and body. */
export function handleRequest(urlPath: string, rootDir: string, deps: Pick<ServeDeps, "disk" | "paths">): ServeResult {
	const safePath = sanitizePath(urlPath);
	const resolved = safePath === "/" || safePath === ""
		? deps.paths.join(rootDir, "index.html")
		: deps.paths.join(rootDir, safePath);

	if (!deps.disk.existsSync(resolved)) {
		return { statusCode: 404, contentType: "text/plain; charset=utf-8", body: "404 Not Found" };
	}

	const contentType = resolveMimeType(resolved, deps.paths);
	const body = BINARY_MIMES.has(contentType)
		? deps.disk.readFileSync(resolved)
		: deps.disk.readFileSync(resolved, "utf-8");
	return { statusCode: 200, contentType, body };
}

/** Sanitize URL path to prevent directory traversal. */
function sanitizePath(urlPath: string): string {
	const decoded = decodeURIComponent(urlPath.split("?")[0]);
	const normalized = decoded.replace(/\\/g, "/");
	const segments = normalized.split("/").filter((s) => s !== ".." && s !== "." && s.length > 0);
	return segments.join("/");
}

// ── JSON body parser ─────────────────────────────────────────────────

/** Parse a JSON body from an incoming HTTP request. */
export function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>); }
			catch { reject(new Error("Invalid JSON")); }
		});
		req.on("error", reject);
	});
}

// ── SSE connection handler ──────────────────────────────────────────

/** Establish a Server-Sent Events connection and register the client. */
export function handleSseConnection(res: ServerResponse, ctx: ServerContext): void {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
	});
	res.write("event: connected\ndata: {}\n\n");
	ctx.sseClients.add(res);
	res.on("close", () => ctx.sseClients.delete(res));
}

// ── API route handler ───────────────────────────────────────────────

/** Dispatch API requests to the appropriate handler. */
export async function handleApiRoute(
	req: IncomingMessage,
	res: ServerResponse,
	urlPath: string,
	ctx: ServerContext,
): Promise<void> {
	const json = (status: number, data: unknown) => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(data));
	};

	if (urlPath === "/events" && req.method === "GET") {
		handleSseConnection(res, ctx);
		return;
	}

	if (urlPath === "/api/world-state" && req.method === "GET") {
		const wsPath = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", "world-state.json");
		if (!ctx.deps.disk.existsSync(wsPath)) { json(404, { error: "No world state" }); return; }
		const content = ctx.deps.disk.readFileSync(wsPath, "utf-8");
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(content);
		return;
	}

	const agentMatch = urlPath.match(/^\/api\/agent\/([^/]+)$/);
	if (agentMatch && req.method === "GET") {
		const entity = ctx.worldState.getEntity(decodeURIComponent(agentMatch[1]));
		json(entity ? 200 : 404, entity ?? { error: "Agent not found" });
		return;
	}

	if (urlPath === "/api/agent/send" && req.method === "POST") {
		const body = await parseJsonBody(req);
		const name = String(body.agentName ?? "");
		const message = String(body.message ?? "");
		if (!name || !message) { json(400, { error: "agentName and message required" }); return; }

		const varDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var");
		const { loadConversation, appendTurn, saveConversation } = await import("../agents/agent-conversation-store.js");
		const conv = loadConversation(ctx.deps, varDir, name);
		const onResponse: SendOptions["onResponse"] = (response) => {
			const withUser = appendTurn(conv, { role: "user", content: message, ts: ctx.deps.clock.iso() });
			const withAgent = appendTurn(withUser, { role: "agent", content: response.message, ts: ctx.deps.clock.iso() });
			saveConversation(ctx.deps, varDir, name, withAgent);
			ctx.worldState.emitAction({
				id: `speak-${Date.now()}`, agentName: name, timestamp: ctx.deps.clock.iso(),
				type: "speaking", data: { text: response.message },
			});
		};
		ctx.workerManager.send(name, message, { foreground: false, onResponse });
		json(200, { ok: true });
		return;
	}

	if (urlPath === "/api/agent/task" && req.method === "POST") {
		const body = await parseJsonBody(req);
		const name = String(body.agentName ?? "");
		const task = String(body.task ?? "");
		if (!name || !task) { json(400, { error: "agentName and task required" }); return; }

		const { readAgentState, addTask, writeAgentState } = await import("../agents/agent-state.js");
		const varDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var");
		const state = readAgentState(ctx.deps, varDir, name);
		const taskId = `task-${Date.now()}`;
		const newState = addTask(state, { name: task, status: "pending", assignedAt: ctx.deps.clock.iso() });
		writeAgentState(ctx.deps, varDir, name, newState);
		ctx.worldState.emitAction({
			id: taskId, agentName: name, timestamp: ctx.deps.clock.iso(),
			type: "task-started", data: { task },
		});
		json(200, { ok: true, taskId });
		return;
	}

	if (urlPath === "/api/agent/permission" && req.method === "POST") {
		const body = await parseJsonBody(req);
		const name = String(body.agentName ?? "");
		const tool = String(body.tool ?? "");
		const decision = String(body.decision ?? "");
		if (!name || !tool || !decision) { json(400, { error: "agentName, tool, and decision required" }); return; }

		const entity = ctx.worldState.getEntity(name);
		const status = entity?.components.status as { currentAction?: string } | undefined;
		if (status?.currentAction !== "requesting-permission") {
			json(200, { ok: true, alreadyResolved: true });
			return;
		}
		const actionType = decision === "allow" ? "permission-granted" : "permission-denied";
		ctx.worldState.emitAction({
			id: `perm-${Date.now()}`, agentName: name, timestamp: ctx.deps.clock.iso(),
			type: actionType, data: { tool },
		});
		json(200, { ok: true });
		return;
	}

	json(404, { error: "Not found" });
}

// ── Server lifecycle ────────────────────────────────────────────────

/**
 * Start an HTTP server serving static files from `dir`.
 *
 * This function dynamically imports Node's `http` module to keep the domain
 * testable without mocking Node internals. Returns a handle with `close()`.
 */
export async function startServer(
	options: ServerOptions,
	deps: ServeDeps,
	context?: ServerContext,
): Promise<ServerHandle> {
	const http = await import("node:http");
	const { port, dir } = options;

	const server = http.createServer(async (req, res) => {
		const rawPath = (req.url ?? "/").split("?")[0];
		if (context && (rawPath.startsWith("/api/") || rawPath === "/events")) {
			try { await handleApiRoute(req, res, rawPath, context); }
			catch { res.writeHead(500); res.end("Internal error"); }
			return;
		}
		const result = handleRequest(req.url ?? "/", dir, deps);
		res.writeHead(result.statusCode, { "Content-Type": result.contentType });
		res.end(result.body);
	});

	return new Promise((resolve) => {
		server.listen(port, () => {
			const url = `http://localhost:${port}`;
			resolve({ url, close: () => server.close() });
		});
	});
}

/** Open a URL in the default browser. */
export function openInBrowser(url: string, shell: IShell): void {
	shell.run(`start "" "${url}"`, { label: "open browser" });
}

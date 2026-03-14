/**
 * static-server.ts — Zero-dependency HTTP static file server.
 *
 * Uses Node built-in `http` and `fs` modules. Serves files from a configurable
 * root directory with proper MIME types and 404 handling.
 */

import type { IFileSystem, IShell, IPaths } from "../../infrastructure/types.js";

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
	readonly body: string;
}

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
	const body = deps.disk.readFileSync(resolved, "utf-8");
	return { statusCode: 200, contentType, body };
}

/** Sanitize URL path to prevent directory traversal. */
function sanitizePath(urlPath: string): string {
	const decoded = decodeURIComponent(urlPath.split("?")[0]);
	const normalized = decoded.replace(/\\/g, "/");
	const segments = normalized.split("/").filter((s) => s !== ".." && s !== "." && s.length > 0);
	return segments.join("/");
}

// ── Server lifecycle ────────────────────────────────────────────────

/**
 * Start an HTTP server serving static files from `dir`.
 *
 * This function dynamically imports Node's `http` module to keep the domain
 * testable without mocking Node internals. Returns a handle with `close()`.
 */
export async function startServer(options: ServerOptions, deps: ServeDeps): Promise<ServerHandle> {
	const http = await import("node:http");
	const { port, dir } = options;

	const server = http.createServer((req, res) => {
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

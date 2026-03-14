import { describe, it, expect } from "vitest";
import { resolveMimeType, handleRequest } from "../../../src/domain/serve/static-server.js";
import type { IFileSystem, IPaths } from "../../../src/infrastructure/types.js";

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

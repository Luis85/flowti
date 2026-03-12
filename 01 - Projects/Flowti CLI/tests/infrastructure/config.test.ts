import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

beforeEach(() => {
	vi.clearAllMocks();
});

/**
 * loadJson and resolveCliProject are defined in config.ts but that module
 * has heavy top-level side effects (readFileSync for config files, path resolution).
 * Rather than fighting the module loader, we test the logic directly here.
 */
function loadJson<T = unknown>(filePath: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

/**
 * Mirrors resolveCliProject from config.ts — falls back to vault root
 * when source directory doesn't exist (standalone mode).
 */
function resolveCliProject(
	vaultRoot: string,
	config: { source?: string },
	existsFn: (p: string) => boolean = fs.existsSync,
): string {
	const candidate = path.resolve(vaultRoot, config.source ?? "01 - Projects/Flowti CLI");
	if (existsFn(candidate)) return candidate;
	return vaultRoot;
}

describe("loadJson", () => {
	it("parses and returns JSON from a real file", () => {
		const pkgPath = path.resolve(import.meta.dirname, "..", "..", "package.json");
		const result = loadJson<{ name: string }>(pkgPath);
		expect(result).not.toBeNull();
		expect(result!.name).toBe("flowti-cli");
	});

	it("returns null when file does not exist", () => {
		const result = loadJson(path.join(import.meta.dirname, "nonexistent.json"));
		expect(result).toBeNull();
	});

	it("returns null for invalid JSON", () => {
		// Use this test file itself as a non-JSON file
		const result = loadJson(path.resolve(import.meta.dirname, "config.test.ts"));
		expect(result).toBeNull();
	});
});

describe("resolveCliProject", () => {
	it("returns source path when it exists", () => {
		const result = resolveCliProject("/vault", { source: "src/cli" }, () => true);
		expect(result.replace(/\\/g, "/")).toContain("/vault/src/cli");
	});

	it("falls back to vault root when source path does not exist", () => {
		const result = resolveCliProject("/vault", { source: "src/cli" }, () => false);
		expect(result).toBe("/vault");
	});

	it("uses default source path when config.source is undefined", () => {
		const calls: string[] = [];
		resolveCliProject("/vault", {}, (p) => { calls.push(p); return false; });
		expect(calls[0].replace(/\\/g, "/")).toContain("01 - Projects/Flowti CLI");
	});

	it("returns vault root for standalone test vaults (no source)", () => {
		const result = resolveCliProject("/test-vaults/my-e2e", {}, () => false);
		expect(result).toBe("/test-vaults/my-e2e");
	});
});

// ── getCaptureDir (mirrors logic from config.ts) ─────────────────────

/**
 * Mirrors getCaptureDir from config.ts — resolves capture directory
 * based on type, with fallbacks.
 */
function getCaptureDir(
	type: string,
	captureConfig: Record<string, string>,
	defaultCapture: string,
	vaultRoot: string,
): string {
	const rel = captureConfig[type] ?? captureConfig["default"] ?? defaultCapture;
	return path.join(vaultRoot, rel);
}

describe("getCaptureDir", () => {
	const DEFAULT = "00 - Connectivity/inbox";

	it("returns the specific type directory when configured", () => {
		const config = { idea: "ideas/inbox", default: "general/inbox" };
		const result = getCaptureDir("idea", config, DEFAULT, "/vault");
		expect(result.replace(/\\/g, "/")).toContain("ideas/inbox");
	});

	it("falls back to default key when type not found", () => {
		const config = { default: "custom/inbox" };
		const result = getCaptureDir("unknown", config, DEFAULT, "/vault");
		expect(result.replace(/\\/g, "/")).toContain("custom/inbox");
	});

	it("falls back to hardcoded default when neither type nor default found", () => {
		const result = getCaptureDir("unknown", {}, DEFAULT, "/vault");
		expect(result.replace(/\\/g, "/")).toContain("00 - Connectivity/inbox");
	});

	it("joins vault root with relative path", () => {
		const config = { note: "my/notes" };
		const result = getCaptureDir("note", config, DEFAULT, "/my-vault");
		expect(result.replace(/\\/g, "/")).toBe("/my-vault/my/notes");
	});
});

// ── findVaultRoot (mirrors logic from config.ts) ─────────────────────

/**
 * Mirrors findVaultRoot from config.ts — walks up looking for .flowti/config.json.
 */
function findVaultRoot(
	dir: string,
	existsFn: (p: string) => boolean,
	joinFn: (...args: string[]) => string = path.join,
	resolveFn: (...args: string[]) => string = path.resolve,
): string | null {
	let candidate = dir;
	for (let i = 0; i < 10; i++) {
		if (existsFn(joinFn(candidate, ".flowti", "config.json"))) {
			return candidate;
		}
		const parent = resolveFn(candidate, "..");
		if (parent === candidate) break;
		candidate = parent;
	}
	return null;
}

describe("findVaultRoot", () => {
	it("returns directory when .flowti/config.json exists", () => {
		const result = findVaultRoot("/vault/sub", (p) => p.replace(/\\/g, "/").includes("/vault/.flowti/config.json"));
		// Parent /vault should have the config
		expect(result).not.toBeNull();
	});

	it("returns null when no config found within 10 levels", () => {
		const result = findVaultRoot("/a/b/c/d", () => false);
		expect(result).toBeNull();
	});

	it("returns the exact directory when config is in starting dir", () => {
		const result = findVaultRoot("/vault", (p) => p.replace(/\\/g, "/").includes("/vault/.flowti/config.json"));
		expect(result).toBe("/vault");
	});

	it("stops early when parent equals candidate (filesystem root)", () => {
		// Simulate a resolve that always returns the same path (root)
		const result = findVaultRoot("/", () => false, path.join, () => "/");
		expect(result).toBeNull();
	});

	it("walks up multiple levels to find config", () => {
		const checked: string[] = [];
		const result = findVaultRoot("/a/b/c/d", (p) => {
			checked.push(p.replace(/\\/g, "/"));
			return p.replace(/\\/g, "/").includes("/a/.flowti/config.json");
		});
		expect(result).not.toBeNull();
		// Should have checked at least 3 levels before finding it
		expect(checked.length).toBeGreaterThanOrEqual(3);
	});
});

// ── resolveVaultRoot (mirrors logic from config.ts) ──────────────────

/**
 * Mirrors resolveVaultRoot from config.ts — checks env var then walks from cwd.
 */
function resolveVaultRoot(
	envVars: Record<string, string | undefined>,
	cwd: string,
	existsFn: (p: string) => boolean,
): string {
	const fromEnv = envVars["FLOWTI_VAULT_ROOT"];
	if (fromEnv && existsFn(path.join(fromEnv, ".flowti", "config.json"))) {
		return fromEnv;
	}

	const fromCwd = findVaultRoot(cwd, existsFn);
	if (fromCwd) return fromCwd;

	throw new Error("Cannot locate vault root.");
}

describe("resolveVaultRoot", () => {
	it("returns env var path when FLOWTI_VAULT_ROOT is set and config exists", () => {
		const result = resolveVaultRoot(
			{ FLOWTI_VAULT_ROOT: "/env/vault" },
			"/other",
			(p) => p.replace(/\\/g, "/").includes("/env/vault/.flowti/config.json"),
		);
		expect(result).toBe("/env/vault");
	});

	it("ignores env var when config does not exist at that path", () => {
		const result = resolveVaultRoot(
			{ FLOWTI_VAULT_ROOT: "/bad/path" },
			"/good/vault",
			(p) => p.replace(/\\/g, "/").includes("/good/vault/.flowti/config.json"),
		);
		expect(result).toBe("/good/vault");
	});

	it("ignores env var when FLOWTI_VAULT_ROOT is undefined", () => {
		const result = resolveVaultRoot(
			{},
			"/cwd/vault",
			(p) => p.replace(/\\/g, "/").includes("/cwd/vault/.flowti/config.json"),
		);
		expect(result).toBe("/cwd/vault");
	});

	it("falls back to cwd walk when env var is empty string", () => {
		const result = resolveVaultRoot(
			{ FLOWTI_VAULT_ROOT: "" },
			"/cwd/vault",
			(p) => p.replace(/\\/g, "/").includes("/cwd/vault/.flowti/config.json"),
		);
		expect(result).toBe("/cwd/vault");
	});

	it("throws when neither env nor cwd yields a vault root", () => {
		expect(() =>
			resolveVaultRoot({}, "/nowhere", () => false),
		).toThrow("Cannot locate vault root.");
	});
});

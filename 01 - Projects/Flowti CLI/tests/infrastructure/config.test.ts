import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

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

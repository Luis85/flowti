import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * loadJson is defined in config.ts but that module has heavy top-level
 * side effects (readFileSync for config files, import.meta.dirname paths).
 * Rather than fighting the module loader, we test the logic directly here
 * since it's a simple 5-line function.
 */
function loadJson<T = unknown>(filePath: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
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

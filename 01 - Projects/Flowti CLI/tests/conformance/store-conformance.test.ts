import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

describe("store conformance", () => {
	const domainDir = join(import.meta.dirname, "../../src/domain");
	const domainDirs = readdirSync(domainDir, { withFileTypes: true })
		.filter(d => d.isDirectory())
		.map(d => d.name);

	// These stores have specialized APIs that don't fit the createStore pattern
	const EXCEPTIONS = new Set([
		"shared/markdown-store.ts",           // base abstraction that createStore wraps
		"agents/agent-conversation-store.ts",  // thread-based persistence, not CRUD
		"agents/brief-store.ts",              // template-based generation, not CRUD
		"onboarding/onboarding-store.ts",     // progress tracking, not CRUD
	]);

	const storeFiles: string[] = [];
	for (const dir of domainDirs) {
		const files = readdirSync(join(domainDir, dir)).filter(f => f.endsWith("-store.ts"));
		for (const f of files) {
			const path = `${dir}/${f}`;
			if (!EXCEPTIONS.has(path)) storeFiles.push(path);
		}
	}

	it("finds store files to check", () => {
		expect(storeFiles.length).toBeGreaterThan(0);
	});

	for (const storeFile of storeFiles) {
		it(`${storeFile} uses createStore engine`, async () => {
			const { readFileSync } = await import("node:fs");
			const content = readFileSync(join(domainDir, storeFile), "utf-8");

			expect(content).toContain("createStore");
		});
	}
});

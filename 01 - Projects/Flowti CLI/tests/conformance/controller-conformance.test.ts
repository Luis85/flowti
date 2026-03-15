import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

describe("controller conformance", () => {
	const controllerDir = join(import.meta.dirname, "../../src/controller");
	const controllerFiles = readdirSync(controllerDir).filter(f => f.endsWith(".controller.ts"));

	it("all controller files exist", () => {
		expect(controllerFiles.length).toBeGreaterThan(0);
	});

	for (const file of controllerFiles) {
		it(`${file} uses adaptDescriptor (not legacy adapt)`, async () => {
			const { readFileSync } = await import("node:fs");
			const content = readFileSync(join(controllerDir, file), "utf-8");

			expect(content).toContain("adaptDescriptor");
			expect(content).not.toMatch(/\bimport\b.*\badapt\b.*from.*request-response/);
			expect(content).not.toContain("ControllerAction");
		});
	}
});

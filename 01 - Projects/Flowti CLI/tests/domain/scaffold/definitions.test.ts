import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDefinition } from "../../../src/domain/scaffold/scaffold-schema.js";
import { sharedTemplates } from "../../../src/domain/scaffold/templates/shared-templates.js";
import { projectTemplates } from "../../../src/domain/scaffold/templates/project-templates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFINITIONS_DIR = resolve(__dirname, "../../../src/domain/scaffold/definitions");

const ALL_TEMPLATE_IDS = [
	...Object.keys(sharedTemplates),
	...Object.keys(projectTemplates),
];

describe("flowti-project.json", () => {
	const raw = JSON.parse(
		readFileSync(resolve(DEFINITIONS_DIR, "flowti-project.json"), "utf-8"),
	);

	it("is a valid scaffold definition", () => {
		const errors = validateDefinition(raw);
		expect(errors).toEqual([]);
	});

	it("has all templateIds resolvable", () => {
		const errors = validateDefinition(raw, ALL_TEMPLATE_IDS);
		expect(errors).toEqual([]);
	});

	it("has id 'flowti-project'", () => {
		expect(raw.id).toBe("flowti-project");
	});

	it("declares package type module", () => {
		expect(raw.package.type).toBe("module");
	});

	it("includes build script", () => {
		expect(raw.package.scripts.build).toBeDefined();
	});

	it("includes test script", () => {
		expect(raw.package.scripts.test).toBeDefined();
	});

	it("includes check script", () => {
		expect(raw.package.scripts.check).toBeDefined();
	});

	it("includes lint script", () => {
		expect(raw.package.scripts.lint).toBeDefined();
	});

	it("includes TypeScript dependency", () => {
		expect(raw.package.devDependencies.typescript).toBeDefined();
	});

	it("includes Vitest dependency", () => {
		expect(raw.package.devDependencies.vitest).toBeDefined();
	});

	it("includes esbuild dependency", () => {
		expect(raw.package.devDependencies.esbuild).toBeDefined();
	});

	it("includes ESLint dependency", () => {
		expect(raw.package.devDependencies.eslint).toBeDefined();
	});

	it("includes tsx dependency", () => {
		expect(raw.package.devDependencies.tsx).toBeDefined();
	});

	it("configures flowti tools for build", () => {
		expect(raw.flowtiConfig.tools.build).toBe("npm run build");
	});

	it("configures publish pipeline", () => {
		expect(raw.flowtiConfig.publish.build).toBeDefined();
		expect(raw.flowtiConfig.publish.test).toBeDefined();
	});

	it("configures review pipeline", () => {
		expect(raw.flowtiConfig.review.build).toBeDefined();
		expect(raw.flowtiConfig.review.test).toBeDefined();
	});

	it("declares at least 8 files", () => {
		expect(raw.files.length).toBeGreaterThanOrEqual(8);
	});

	it("includes src/main.ts", () => {
		expect(raw.files.some((f: { path: string }) => f.path === "src/main.ts")).toBe(true);
	});

	it("includes tests/main.test.ts", () => {
		expect(raw.files.some((f: { path: string }) => f.path === "tests/main.test.ts")).toBe(true);
	});

	it("includes configs/flowti.config.json", () => {
		expect(raw.files.some((f: { path: string }) => f.path === "configs/flowti.config.json")).toBe(true);
	});

	it("has next steps", () => {
		expect(raw.nextSteps.length).toBeGreaterThan(0);
	});
});

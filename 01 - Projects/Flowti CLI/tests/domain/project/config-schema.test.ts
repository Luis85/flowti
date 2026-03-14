import { describe, it, expect } from "vitest";
import { validateProjectConfig, isValidProjectConfig } from "../../../src/domain/project/config-schema.js";

// ── Helpers ──────────────────────────────────────────────────────────

function valid(overrides: Record<string, unknown> = {}) {
	return { name: "My Project", ...overrides };
}

// ── validateProjectConfig ────────────────────────────────────────────

describe("validateProjectConfig", () => {
	describe("top-level", () => {
		it("accepts minimal valid config (name only)", () => {
			const { errors, warnings } = validateProjectConfig({ name: "Test" });
			expect(errors).toEqual([]);
			expect(warnings).toEqual([]);
		});

		it("rejects null", () => {
			const { errors } = validateProjectConfig(null);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("non-null object");
		});

		it("rejects undefined", () => {
			const { errors } = validateProjectConfig(undefined);
			expect(errors).toHaveLength(1);
		});

		it("rejects non-object (string)", () => {
			const { errors } = validateProjectConfig("not an object");
			expect(errors).toHaveLength(1);
		});

		it("rejects non-object (number)", () => {
			const { errors } = validateProjectConfig(42);
			expect(errors).toHaveLength(1);
		});
	});

	describe("name", () => {
		it("errors on missing name", () => {
			const { errors } = validateProjectConfig({});
			expect(errors).toContainEqual(expect.stringContaining('"name"'));
		});

		it("errors on empty name", () => {
			const { errors } = validateProjectConfig({ name: "" });
			expect(errors).toContainEqual(expect.stringContaining('"name"'));
		});

		it("errors on non-string name", () => {
			const { errors } = validateProjectConfig({ name: 42 });
			expect(errors).toContainEqual(expect.stringContaining('"name"'));
		});
	});

	describe("build", () => {
		it("accepts valid build config with commands", () => {
			const { errors, warnings } = validateProjectConfig(valid({ build: { commands: { fast: "npm run build" } } }));
			expect(errors).toEqual([]);
			expect(warnings).toEqual([]);
		});

		it("skips validation when build is undefined", () => {
			const { errors } = validateProjectConfig(valid());
			expect(errors).toEqual([]);
		});

		it("warns on non-object build", () => {
			const { warnings } = validateProjectConfig(valid({ build: "not-obj" }));
			expect(warnings).toContainEqual(expect.stringContaining('"build" must be an object'));
		});

		it("warns on non-object build.commands", () => {
			const { warnings } = validateProjectConfig(valid({ build: { commands: "not-obj" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"build.commands" must be an object'));
		});
	});

	describe("make.templates", () => {
		it("accepts valid template IDs", () => {
			const { warnings } = validateProjectConfig(valid({ make: { templates: ["journey", "component"] } }));
			expect(warnings).toEqual([]);
		});

		it("warns on unknown template", () => {
			const { warnings } = validateProjectConfig(valid({ make: { templates: ["bogus"] } }));
			expect(warnings).toContainEqual(expect.stringContaining('unknown template "bogus"'));
		});

		it("warns on non-array templates", () => {
			const { warnings } = validateProjectConfig(valid({ make: { templates: "not-array" } }));
			expect(warnings).toContainEqual(expect.stringContaining("must be an array"));
		});

		it("warns on non-object make", () => {
			const { warnings } = validateProjectConfig(valid({ make: "bad" }));
			expect(warnings).toContainEqual(expect.stringContaining('"make" must be an object'));
		});
	});

	describe("reports", () => {
		it("accepts valid reports config", () => {
			const { errors } = validateProjectConfig(valid({
				reports: { dir: "output/reports", generators: [{ label: "Test", id: "test-gen" }] },
			}));
			expect(errors).toEqual([]);
		});

		it("errors on non-string reports.dir", () => {
			const { errors } = validateProjectConfig(valid({ reports: { dir: 42 } }));
			expect(errors).toContainEqual(expect.stringContaining('"reports.dir" must be a string'));
		});

		it("errors on non-array generators", () => {
			const { errors } = validateProjectConfig(valid({ reports: { generators: "not-array" } }));
			expect(errors).toContainEqual(expect.stringContaining('"reports.generators" must be an array'));
		});

		it("errors when generator missing label", () => {
			const { errors } = validateProjectConfig(valid({ reports: { generators: [{ id: "x" }] } }));
			expect(errors).toContainEqual(expect.stringContaining('missing "label"'));
		});

		it("errors when generator has neither id nor command", () => {
			const { errors } = validateProjectConfig(valid({ reports: { generators: [{ label: "Test" }] } }));
			expect(errors).toContainEqual(expect.stringContaining('"id" or "command"'));
		});

		it("accepts generator with command only", () => {
			const { errors } = validateProjectConfig(valid({ reports: { generators: [{ label: "Test", command: "npm run test" }] } }));
			expect(errors).toEqual([]);
		});

		it("errors on non-object generator entry", () => {
			const { errors } = validateProjectConfig(valid({ reports: { generators: ["bad"] } }));
			expect(errors).toContainEqual(expect.stringContaining("must be an object"));
		});

		it("errors on non-object reports", () => {
			const { errors } = validateProjectConfig(valid({ reports: "bad" }));
			expect(errors).toContainEqual(expect.stringContaining('"reports" must be an object'));
		});
	});

	describe("publish.endpoints", () => {
		it("accepts valid endpoints", () => {
			const { errors } = validateProjectConfig(valid({ publish: { endpoints: [{ name: "prod", path: "/deploy" }] } }));
			expect(errors).toEqual([]);
		});

		it("errors on missing endpoint name", () => {
			const { errors } = validateProjectConfig(valid({ publish: { endpoints: [{ path: "/x" }] } }));
			expect(errors).toContainEqual(expect.stringContaining('missing "name"'));
		});

		it("errors on missing endpoint path", () => {
			const { errors } = validateProjectConfig(valid({ publish: { endpoints: [{ name: "prod" }] } }));
			expect(errors).toContainEqual(expect.stringContaining('missing "path"'));
		});

		it("errors on non-array endpoints", () => {
			const { errors } = validateProjectConfig(valid({ publish: { endpoints: "bad" } }));
			expect(errors).toContainEqual(expect.stringContaining('"publish.endpoints" must be an array'));
		});

		it("errors on non-object publish", () => {
			const { errors } = validateProjectConfig(valid({ publish: "bad" }));
			expect(errors).toContainEqual(expect.stringContaining('"publish" must be an object'));
		});

		it("errors on non-object endpoint entry", () => {
			const { errors } = validateProjectConfig(valid({ publish: { endpoints: [null] } }));
			expect(errors).toContainEqual(expect.stringContaining("must be an object"));
		});
	});

	describe("docs.generators", () => {
		it("accepts valid docs generators", () => {
			const { errors } = validateProjectConfig(valid({ docs: { generators: [{ label: "API", command: "npm run docs" }] } }));
			expect(errors).toEqual([]);
		});

		it("errors on missing label", () => {
			const { errors } = validateProjectConfig(valid({ docs: { generators: [{ command: "cmd" }] } }));
			expect(errors).toContainEqual(expect.stringContaining('missing "label"'));
		});

		it("errors on missing command", () => {
			const { errors } = validateProjectConfig(valid({ docs: { generators: [{ label: "API" }] } }));
			expect(errors).toContainEqual(expect.stringContaining('missing "command"'));
		});

		it("errors on non-array generators", () => {
			const { errors } = validateProjectConfig(valid({ docs: { generators: "bad" } }));
			expect(errors).toContainEqual(expect.stringContaining('"docs.generators" must be an array'));
		});

		it("errors on non-object docs", () => {
			const { errors } = validateProjectConfig(valid({ docs: 42 }));
			expect(errors).toContainEqual(expect.stringContaining('"docs" must be an object'));
		});
	});

	describe("review", () => {
		it("accepts valid review config", () => {
			const { warnings } = validateProjectConfig(valid({ review: { journeysDir: "tests/e2e" } }));
			expect(warnings).toEqual([]);
		});

		it("warns on non-string journeysDir", () => {
			const { warnings } = validateProjectConfig(valid({ review: { journeysDir: 42 } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.journeysDir" must be a string'));
		});

		it("warns on non-object review", () => {
			const { warnings } = validateProjectConfig(valid({ review: "bad" }));
			expect(warnings).toContainEqual(expect.stringContaining('"review" must be an object'));
		});
	});

	describe("components", () => {
		it("accepts valid components config", () => {
			const { warnings } = validateProjectConfig(valid({ components: { storybook: true, storybookDir: "sb" } }));
			expect(warnings).toEqual([]);
		});

		it("accepts empty components object", () => {
			const { warnings } = validateProjectConfig(valid({ components: {} }));
			expect(warnings).toEqual([]);
		});

		it("warns on non-object components", () => {
			const { warnings } = validateProjectConfig(valid({ components: "bad" }));
			expect(warnings).toContainEqual(expect.stringContaining('"components" must be an object'));
		});

		it("warns on non-boolean storybook", () => {
			const { warnings } = validateProjectConfig(valid({ components: { storybook: "yes" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"components.storybook" must be a boolean'));
		});

		it("warns on non-string storybookDir", () => {
			const { warnings } = validateProjectConfig(valid({ components: { storybookDir: 42 } }));
			expect(warnings).toContainEqual(expect.stringContaining('"components.storybookDir" must be a string'));
		});
	});

	describe("health", () => {
		it("accepts valid health config", () => {
			const { warnings } = validateProjectConfig(valid({
				health: { thresholds: { coverage: { min: 70, target: 85 }, lint: { maxErrors: 0 }, tests: { minPassed: 3600 } } },
			}));
			expect(warnings).toEqual([]);
		});

		it("accepts empty health object", () => {
			const { warnings } = validateProjectConfig(valid({ health: {} }));
			expect(warnings).toEqual([]);
		});

		it("warns on non-object health", () => {
			const { warnings } = validateProjectConfig(valid({ health: "bad" }));
			expect(warnings).toContainEqual(expect.stringContaining('"health" must be an object'));
		});

		it("warns on non-object thresholds", () => {
			const { warnings } = validateProjectConfig(valid({ health: { thresholds: "bad" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"health.thresholds" must be an object'));
		});

		it("warns on non-number coverage.min", () => {
			const { warnings } = validateProjectConfig(valid({ health: { thresholds: { coverage: { min: "bad" } } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"health.thresholds.coverage.min" must be a number'));
		});

		it("warns on non-number lint.maxErrors", () => {
			const { warnings } = validateProjectConfig(valid({ health: { thresholds: { lint: { maxErrors: true } } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"health.thresholds.lint.maxErrors" must be a number'));
		});

		it("warns on non-number tests.minPassed", () => {
			const { warnings } = validateProjectConfig(valid({ health: { thresholds: { tests: { minPassed: "bad" } } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"health.thresholds.tests.minPassed" must be a number'));
		});

		it("warns on non-object qualityGates", () => {
			const { warnings } = validateProjectConfig(valid({ health: { qualityGates: "bad" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"health.qualityGates" must be an object'));
		});

		it("warns on non-object coverage threshold group", () => {
			const { warnings } = validateProjectConfig(valid({ health: { thresholds: { coverage: "bad" } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"health.thresholds.coverage" must be an object'));
		});
	});

	describe("management", () => {
		it("accepts valid management config", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { resources: { dir: "docs/resources" }, timelog: { dir: "docs/timelog" } },
			}));
			expect(warnings).toEqual([]);
		});

		it("accepts empty management object", () => {
			const { warnings } = validateProjectConfig(valid({ management: {} }));
			expect(warnings).toEqual([]);
		});

		it("warns on non-object management", () => {
			const { warnings } = validateProjectConfig(valid({ management: "bad" }));
			expect(warnings).toContainEqual(expect.stringContaining('"management" must be an object'));
		});

		it("warns on non-object resources section", () => {
			const { warnings } = validateProjectConfig(valid({ management: { resources: "bad" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"management.resources" must be an object'));
		});

		it("warns on non-string dir in section", () => {
			const { warnings } = validateProjectConfig(valid({ management: { timelog: { dir: 42 } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"management.timelog.dir" must be a string'));
		});

		it("validates all dir-based sections", () => {
			for (const section of ["resources", "timelog", "deliverables", "raid", "requirements", "capa", "iterations"]) {
				const { warnings } = validateProjectConfig(valid({ management: { [section]: { dir: "docs" } } }));
				expect(warnings).toEqual([]);
			}
		});

		it("warns on non-number iterations.durationDays", () => {
			const { warnings } = validateProjectConfig(valid({ management: { iterations: { durationDays: "bad" } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"management.iterations.durationDays" must be a number'));
		});

		it("accepts valid iterations config", () => {
			const { warnings } = validateProjectConfig(valid({ management: { iterations: { dir: "docs/iterations", durationDays: 14 } } }));
			expect(warnings).toEqual([]);
		});

		it("warns on non-object lifecycle", () => {
			const { warnings } = validateProjectConfig(valid({ management: { lifecycle: "bad" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"management.lifecycle" must be an object'));
		});

		it("warns on non-string lifecycle.featuresDir", () => {
			const { warnings } = validateProjectConfig(valid({ management: { lifecycle: { featuresDir: 42 } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"management.lifecycle.featuresDir" must be a string'));
		});

		it("accepts valid lifecycle config", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { lifecycle: { featuresDir: "docs/features", productsDir: "docs/products" } },
			}));
			expect(warnings).toEqual([]);
		});

		it("accepts valid orchestration config", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { iterations: { orchestration: { phases: { "new": { agent: "PO", role: "refiner" } } } } },
			}));
			expect(warnings).toEqual([]);
		});

		it("warns on non-object orchestration", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { iterations: { orchestration: "bad" } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"management.iterations.orchestration" must be an object'));
		});

		it("warns on non-object orchestration.phases", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { iterations: { orchestration: { phases: "bad" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"management.iterations.orchestration.phases" must be an object'));
		});

		it("warns when phase binding missing agent", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { iterations: { orchestration: { phases: { "new": { role: "refiner" } } } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"management.iterations.orchestration.phases.new.agent" is required'));
		});

		it("warns on non-string phase binding role", () => {
			const { warnings } = validateProjectConfig(valid({
				management: { iterations: { orchestration: { phases: { "new": { agent: "PO", role: 42 } } } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"management.iterations.orchestration.phases.new.role" must be a string'));
		});
	});

	describe("unknown keys", () => {
		it("warns on unknown top-level keys", () => {
			const { warnings } = validateProjectConfig(valid({ unknownKey: true }));
			expect(warnings).toContainEqual(expect.stringContaining('Unknown top-level key: "unknownKey"'));
		});

		it("does not warn on known keys", () => {
			const { warnings } = validateProjectConfig({
				name: "Test", build: {}, test: {}, devtools: {}, paths: {}, make: {}, components: {}, reports: {}, docs: {}, publish: {}, review: {}, health: {}, management: {},
			});
			expect(warnings).toEqual([]);
		});
	});
});

// ── isValidProjectConfig ─────────────────────────────────────────────

describe("isValidProjectConfig", () => {
	it("returns true for valid config", () => {
		expect(isValidProjectConfig({ name: "Test" })).toBe(true);
	});

	it("returns false when errors exist", () => {
		expect(isValidProjectConfig({})).toBe(false);
	});

	it("returns true even with warnings", () => {
		expect(isValidProjectConfig({ name: "Test", unknownKey: true })).toBe(true);
	});

	it("returns false for null", () => {
		expect(isValidProjectConfig(null)).toBe(false);
	});
});

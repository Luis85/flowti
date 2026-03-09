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

	describe("tools", () => {
		it("accepts valid tool IDs", () => {
			const { errors } = validateProjectConfig(valid({ tools: { build: "npm run build", reports: "npm run reports" } }));
			expect(errors).toEqual([]);
		});

		it("errors on unknown tool ID", () => {
			const { errors } = validateProjectConfig(valid({ tools: { unknown: "cmd" } }));
			expect(errors).toContainEqual(expect.stringContaining('unknown tool ID "unknown"'));
		});

		it("errors on non-string tool value", () => {
			const { errors } = validateProjectConfig(valid({ tools: { build: 42 } }));
			expect(errors).toContainEqual(expect.stringContaining("tools.build"));
		});

		it("errors on non-object tools", () => {
			const { errors } = validateProjectConfig(valid({ tools: "not-obj" }));
			expect(errors).toContainEqual(expect.stringContaining('"tools" must be an object'));
		});

		it("skips validation when tools is undefined", () => {
			const { errors } = validateProjectConfig(valid());
			expect(errors).toEqual([]);
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

	describe("unknown keys", () => {
		it("warns on unknown top-level keys", () => {
			const { warnings } = validateProjectConfig(valid({ unknownKey: true }));
			expect(warnings).toContainEqual(expect.stringContaining('Unknown top-level key: "unknownKey"'));
		});

		it("does not warn on known keys", () => {
			const { warnings } = validateProjectConfig({
				name: "Test", tools: {}, make: {}, components: {}, reports: {}, docs: {}, publish: {}, review: {},
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

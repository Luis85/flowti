import { describe, it, expect } from "vitest";

import {
	ENTITY_REGISTRY,
	type EntityDef,
} from "../../../../src/domain/reports/generators/entity-registry.js";

// ── Registry completeness ─────────────────────────────────────────────

describe("ENTITY_REGISTRY", () => {
	it("is a non-empty array", () => {
		expect(Array.isArray(ENTITY_REGISTRY)).toBe(true);
		expect(ENTITY_REGISTRY.length).toBeGreaterThan(0);
	});

	it("contains only well-formed EntityDef objects", () => {
		for (const entity of ENTITY_REGISTRY) {
			expect(typeof entity.name).toBe("string");
			expect(entity.name.length).toBeGreaterThan(0);

			expect(typeof entity.description).toBe("string");
			expect(entity.description.length).toBeGreaterThan(0);

			expect(typeof entity.purpose).toBe("string");
			expect(entity.purpose.length).toBeGreaterThan(0);

			expect(Array.isArray(entity.locations)).toBe(true);
			expect(entity.locations.length).toBeGreaterThan(0);

			expect(Array.isArray(entity.relatedEntities)).toBe(true);
			expect(Array.isArray(entity.commands)).toBe(true);
			expect(Array.isArray(entity.artifacts)).toBe(true);
		}
	});

	it("has unique entity names", () => {
		const names = ENTITY_REGISTRY.map((e) => e.name);
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});

	it("configKey is either undefined or a non-empty string", () => {
		for (const entity of ENTITY_REGISTRY) {
			if (entity.configKey !== undefined) {
				expect(typeof entity.configKey).toBe("string");
				expect(entity.configKey.length).toBeGreaterThan(0);
			}
		}
	});

	it("locations entries are non-empty strings", () => {
		for (const entity of ENTITY_REGISTRY) {
			for (const loc of entity.locations) {
				expect(typeof loc).toBe("string");
				expect(loc.length).toBeGreaterThan(0);
			}
		}
	});

	it("relatedEntities reference names that exist in the registry", () => {
		const knownNames = new Set(ENTITY_REGISTRY.map((e) => e.name));
		for (const entity of ENTITY_REGISTRY) {
			for (const related of entity.relatedEntities) {
				expect(knownNames.has(related)).toBe(true);
			}
		}
	});
});

// ── Specific entity spot checks ───────────────────────────────────────

describe("Known entities", () => {
	const byName = (name: string): EntityDef =>
		ENTITY_REGISTRY.find((e) => e.name === name)!;

	it("includes Flowti Project with expected fields", () => {
		const project = byName("Flowti Project");
		expect(project).toBeDefined();
		expect(project.configKey).toContain("name");
		expect(project.commands).toContain("project");
		expect(project.artifacts).toContain("configs/flowti.config.json");
		expect(project.relatedEntities).toContain("Report");
	});

	it("includes Journey with e2e commands", () => {
		const journey = byName("Journey");
		expect(journey).toBeDefined();
		expect(journey.commands).toContain("e2e");
		expect(journey.commands).toContain("make:journey");
		expect(journey.configKey).toBe("review.journeysDir");
	});

	it("includes Component with make command", () => {
		const component = byName("Component");
		expect(component).toBeDefined();
		expect(component.commands).toContain("make:component");
		expect(component.relatedEntities).toContain("Component Library");
	});

	it("includes Report with report commands", () => {
		const report = byName("Report");
		expect(report).toBeDefined();
		expect(report.commands.some((c) => c.startsWith("report:"))).toBe(true);
		expect(report.configKey).toContain("reports");
	});

	it("includes Health Snapshot with health command", () => {
		const health = byName("Health Snapshot");
		expect(health).toBeDefined();
		expect(health.commands).toContain("health");
		expect(health.relatedEntities).toContain("Flowti Project");
	});

	it("includes Lifecycle with transition commands", () => {
		const lifecycle = byName("Lifecycle");
		expect(lifecycle).toBeDefined();
		expect(lifecycle.commands).toContain("lifecycle:transition");
		expect(lifecycle.commands).toContain("lifecycle:status");
	});

	it("includes CAPA Item", () => {
		const capa = byName("CAPA Item");
		expect(capa).toBeDefined();
		expect(capa.commands).toContain("capa:add");
		expect(capa.relatedEntities).toContain("RAID Item");
	});

	it("includes Requirement with IREB-related content", () => {
		const req = byName("Requirement");
		expect(req).toBeDefined();
		expect(req.description).toContain("IREB");
		expect(req.relatedEntities).toContain("Use Case");
		expect(req.relatedEntities).toContain("User Story");
	});

	it("includes Entity Template", () => {
		const tpl = byName("Entity Template");
		expect(tpl).toBeDefined();
		expect(tpl.configKey).toBe("templates");
		expect(tpl.commands).toEqual([]);
	});
});

// ── EntityDef interface conformance ───────────────────────────────────

describe("EntityDef interface", () => {
	it("all entries satisfy the EntityDef shape", () => {
		const requiredKeys: (keyof EntityDef)[] = [
			"name",
			"description",
			"purpose",
			"locations",
			"relatedEntities",
			"commands",
			"artifacts",
		];
		for (const entity of ENTITY_REGISTRY) {
			for (const key of requiredKeys) {
				expect(entity).toHaveProperty(key);
			}
		}
	});

	it("all array fields contain only strings", () => {
		const arrayKeys: (keyof EntityDef)[] = [
			"locations",
			"relatedEntities",
			"commands",
			"artifacts",
		];
		for (const entity of ENTITY_REGISTRY) {
			for (const key of arrayKeys) {
				const arr = entity[key] as string[];
				for (const item of arr) {
					expect(typeof item).toBe("string");
				}
			}
		}
	});
});

// ── Registry coverage ─────────────────────────────────────────────────

describe("Registry coverage", () => {
	const expectedEntities = [
		"Flowti Project",
		"Journey",
		"Component",
		"Component Library",
		"Test",
		"Test Suite",
		"Event",
		"Event Catalog",
		"Report",
		"Build Manifest",
		"Plugin Hooks",
		"Scaffold Definition",
		"Export Bundle",
		"Health Snapshot",
		"Resource",
		"Time-Log Entry",
		"Deliverable",
		"RAID Item",
		"Requirement",
		"Use Case",
		"User Story",
		"CAPA Item",
		"Product",
		"Feature",
		"Lifecycle",
		"Entity Template",
	];

	it("contains all expected entities", () => {
		const names = ENTITY_REGISTRY.map((e) => e.name);
		for (const expected of expectedEntities) {
			expect(names).toContain(expected);
		}
	});

	it("has exactly the expected number of entities", () => {
		expect(ENTITY_REGISTRY).toHaveLength(expectedEntities.length);
	});
});

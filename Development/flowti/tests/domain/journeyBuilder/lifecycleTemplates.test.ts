import { describe, it, expect } from "vitest";
import {
	generateBacklogReview,
	generatePlanning,
	generateDevelopment,
	generateTesting,
	generateReview,
	LIFECYCLE_TEMPLATES,
} from "../../../src/domain/journeyBuilder/lifecycleTemplates";

describe("Lifecycle Journey Templates", () => {
	const featureName = "MVP - Product Development Lifecycle";

	describe("template generators", () => {
		it("generates backlog-review template", () => {
			const template = generateBacklogReview(featureName);
			expect(template.journey).toContain("Backlog Review");
			expect(template.journey).toContain(featureName);
			expect(template.feature).toBe(featureName);
			expect(template.category).toBe("lifecycle");
			expect(template.steps.length).toBeGreaterThanOrEqual(3);
		});

		it("generates planning template", () => {
			const template = generatePlanning(featureName);
			expect(template.journey).toContain("Planning");
			expect(template.feature).toBe(featureName);
			expect(template.steps.length).toBeGreaterThanOrEqual(3);
		});

		it("generates development template", () => {
			const template = generateDevelopment(featureName);
			expect(template.journey).toContain("Development");
			expect(template.feature).toBe(featureName);
			expect(template.steps.length).toBeGreaterThanOrEqual(3);
		});

		it("generates testing template", () => {
			const template = generateTesting(featureName);
			expect(template.journey).toContain("Testing");
			expect(template.feature).toBe(featureName);
			expect(template.type).toBe("regression");
			expect(template.steps.length).toBeGreaterThanOrEqual(4);
		});

		it("generates review template", () => {
			const template = generateReview(featureName);
			expect(template.journey).toContain("Review");
			expect(template.feature).toBe(featureName);
			expect(template.steps.length).toBeGreaterThanOrEqual(4);
		});
	});

	describe("template structure", () => {
		for (const tmpl of LIFECYCLE_TEMPLATES) {
			it(`${tmpl.id} template has valid step structure`, () => {
				const template = tmpl.generate("Test Feature");
				for (const step of template.steps) {
					expect(step.id).toBeTruthy();
					expect(step.title).toBeTruthy();
					expect(step.description).toBeTruthy();
					expect(step.actions.length).toBeGreaterThan(0);
					for (const action of step.actions) {
						expect(action.tool).toBeTruthy();
					}
				}
			});
		}
	});

	describe("LIFECYCLE_TEMPLATES registry", () => {
		it("contains 5 templates", () => {
			expect(LIFECYCLE_TEMPLATES).toHaveLength(5);
		});

		it("has unique ids", () => {
			const ids = LIFECYCLE_TEMPLATES.map((t) => t.id);
			expect(new Set(ids).size).toBe(5);
		});

		it("has expected template ids", () => {
			const ids = LIFECYCLE_TEMPLATES.map((t) => t.id);
			expect(ids).toContain("backlog-review");
			expect(ids).toContain("planning");
			expect(ids).toContain("development");
			expect(ids).toContain("testing");
			expect(ids).toContain("review");
		});
	});
});

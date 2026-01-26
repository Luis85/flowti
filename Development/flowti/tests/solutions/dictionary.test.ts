import { describe, it, expect } from "vitest";
import {
	DATA_DICTIONARY,
	getAllTerms,
	getTerm,
	type DictionaryTermName,
} from "../../src/solutions/dictionary";

describe("Data Dictionary", () => {
	describe("DATA_DICTIONARY", () => {
		it("should have core entity terms", () => {
			expect(DATA_DICTIONARY.Solution).toBeDefined();
			expect(DATA_DICTIONARY.SolutionType).toBeDefined();
			expect(DATA_DICTIONARY.LifecyclePhase).toBeDefined();
			expect(DATA_DICTIONARY.Deliverable).toBeDefined();
		});

		it("should have solution type terms", () => {
			expect(DATA_DICTIONARY.Application).toBeDefined();
			expect(DATA_DICTIONARY.Process).toBeDefined();
			expect(DATA_DICTIONARY.Service).toBeDefined();
			expect(DATA_DICTIONARY.Product).toBeDefined();
			expect(DATA_DICTIONARY.Capability).toBeDefined();
			expect(DATA_DICTIONARY.Data).toBeDefined();
			expect(DATA_DICTIONARY.Tool).toBeDefined();
			expect(DATA_DICTIONARY.Organization).toBeDefined();
			expect(DATA_DICTIONARY.Policy).toBeDefined();
		});

		it("should have traceability terms", () => {
			expect(DATA_DICTIONARY.UUID).toBeDefined();
			expect(DATA_DICTIONARY.Frontmatter).toBeDefined();
			expect(DATA_DICTIONARY.Traceability).toBeDefined();
		});

		it("should have metric terms for future gamification", () => {
			expect(DATA_DICTIONARY.Metric).toBeDefined();
			expect(DATA_DICTIONARY.XP).toBeDefined();
		});
	});

	describe("Term Structure", () => {
		it("each term should have id and definition", () => {
			for (const [name, term] of Object.entries(DATA_DICTIONARY)) {
				expect(term.id, `${name} should have id`).toBeDefined();
				expect(term.definition, `${name} should have definition`).toBeDefined();
			}
		});

		it("term IDs should follow TERM-xxx format", () => {
			for (const [name, term] of Object.entries(DATA_DICTIONARY)) {
				expect(term.id, `${name} ID should match pattern`).toMatch(
					/^TERM-\d{3}$/
				);
			}
		});

		it("term IDs should be unique", () => {
			const ids = Object.values(DATA_DICTIONARY).map((t) => t.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});
	});

	describe("Solution Term", () => {
		it("should have correct structure", () => {
			const solution = DATA_DICTIONARY.Solution;

			expect(solution.id).toBe("TERM-001");
			expect(solution.definition).toContain("Problem löst");
			expect(solution.synonyms).toContain("Project");
			expect(solution.synonyms).toContain("Initiative");
			expect(solution.relatedTerms).toContain("SolutionType");
			expect(solution.relatedTerms).toContain("LifecyclePhase");
		});
	});

	describe("SolutionType Term", () => {
		it("should list all 9 solution types", () => {
			const solutionType = DATA_DICTIONARY.SolutionType;

			expect(solutionType.values).toHaveLength(9);
			expect(solutionType.values).toContain("Application");
			expect(solutionType.values).toContain("Process");
			expect(solutionType.values).toContain("Service");
			expect(solutionType.values).toContain("Product");
			expect(solutionType.values).toContain("Capability");
			expect(solutionType.values).toContain("Data");
			expect(solutionType.values).toContain("Tool");
			expect(solutionType.values).toContain("Organization");
			expect(solutionType.values).toContain("Policy");
		});
	});

	describe("LifecyclePhase Term", () => {
		it("should list all 9 lifecycle phases in order", () => {
			const phase = DATA_DICTIONARY.LifecyclePhase;

			expect(phase.values).toHaveLength(9);
			expect(phase.values?.[0]).toBe("Ideate");
			expect(phase.values?.[1]).toBe("Design");
			expect(phase.values?.[2]).toBe("Validate");
			expect(phase.values?.[3]).toBe("Develop");
			expect(phase.values?.[4]).toBe("Test");
			expect(phase.values?.[5]).toBe("Release");
			expect(phase.values?.[6]).toBe("Run");
			expect(phase.values?.[7]).toBe("Measure");
			expect(phase.values?.[8]).toBe("Learn");
		});
	});

	describe("UUID Term", () => {
		it("should specify the UUID format", () => {
			const uuid = DATA_DICTIONARY.UUID;

			expect(uuid.format).toBe("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx");
		});
	});

	describe("getTerm helper", () => {
		it("should return correct term by name", () => {
			const solution = getTerm("Solution");
			expect(solution.id).toBe("TERM-001");
		});

		it("should work for all term names", () => {
			const termNames: DictionaryTermName[] = [
				"Solution",
				"SolutionType",
				"LifecyclePhase",
				"Application",
				"UUID",
			];

			for (const name of termNames) {
				const term = getTerm(name);
				expect(term).toBeDefined();
				expect(term.id).toBeDefined();
			}
		});
	});

	describe("getAllTerms helper", () => {
		it("should return all terms as array", () => {
			const terms = getAllTerms();

			expect(Array.isArray(terms)).toBe(true);
			expect(terms.length).toBeGreaterThan(0);

			// Each term should have required fields
			for (const term of terms) {
				expect(term.id).toBeDefined();
				expect(term.definition).toBeDefined();
			}
		});

		it("should include same number of terms as dictionary", () => {
			const terms = getAllTerms();
			const dictionaryKeys = Object.keys(DATA_DICTIONARY);

			expect(terms.length).toBe(dictionaryKeys.length);
		});
	});
});

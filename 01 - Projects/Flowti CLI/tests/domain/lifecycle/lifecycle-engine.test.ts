import { describe, it, expect } from "vitest";
import { getTemplate, getValidTransitions, validateTransition, isTerminal } from "../../../src/domain/lifecycle/lifecycle-engine.js";

describe("getTemplate", () => {
	it("returns project template", () => {
		const t = getTemplate("project");
		expect(t.entityType).toBe("project");
		expect(t.initialState).toBe("inception");
		expect(t.states).toContain("planning");
		expect(t.terminalStates).toEqual(["archived"]);
	});

	it("returns product template", () => {
		const t = getTemplate("product");
		expect(t.entityType).toBe("product");
		expect(t.initialState).toBe("concept");
		expect(t.terminalStates).toEqual(["sunset"]);
	});

	it("returns feature template", () => {
		const t = getTemplate("feature");
		expect(t.entityType).toBe("feature");
		expect(t.initialState).toBe("ideation");
		expect(t.terminalStates).toEqual(["deprecated"]);
	});
});

describe("getValidTransitions", () => {
	it("returns valid transitions for project inception", () => {
		const t = getTemplate("project");
		expect(getValidTransitions(t, "inception")).toEqual(["planning"]);
	});

	it("returns multiple transitions for project planning", () => {
		const t = getTemplate("project");
		expect(getValidTransitions(t, "planning")).toEqual(["execution", "inception"]);
	});

	it("returns empty array for terminal state", () => {
		const t = getTemplate("project");
		expect(getValidTransitions(t, "archived")).toEqual([]);
	});

	it("returns empty array for unknown state", () => {
		const t = getTemplate("project");
		expect(getValidTransitions(t, "nonexistent")).toEqual([]);
	});

	it("allows feature testing to go back to development", () => {
		const t = getTemplate("feature");
		expect(getValidTransitions(t, "testing")).toEqual(["release", "development"]);
	});
});

describe("validateTransition", () => {
	it("succeeds for valid transition", () => {
		const t = getTemplate("project");
		const result = validateTransition(t, "inception", "planning");
		expect(result.success).toBe(true);
		expect(result.from).toBe("inception");
		expect(result.to).toBe("planning");
	});

	it("fails for invalid transition", () => {
		const t = getTemplate("project");
		const result = validateTransition(t, "inception", "archived");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot transition");
		expect(result.error).toContain("planning");
	});

	it("fails for unknown source state", () => {
		const t = getTemplate("project");
		const result = validateTransition(t, "nonexistent", "planning");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unknown state");
	});

	it("fails for terminal state transition", () => {
		const t = getTemplate("product");
		const result = validateTransition(t, "sunset", "concept");
		expect(result.success).toBe(false);
		expect(result.error).toContain("terminal state");
	});
});

describe("isTerminal", () => {
	it("returns true for terminal states", () => {
		expect(isTerminal(getTemplate("project"), "archived")).toBe(true);
		expect(isTerminal(getTemplate("product"), "sunset")).toBe(true);
		expect(isTerminal(getTemplate("feature"), "deprecated")).toBe(true);
	});

	it("returns false for non-terminal states", () => {
		expect(isTerminal(getTemplate("project"), "inception")).toBe(false);
		expect(isTerminal(getTemplate("product"), "growth")).toBe(false);
		expect(isTerminal(getTemplate("feature"), "testing")).toBe(false);
	});
});

describe("lifecycle completeness", () => {
	for (const entityType of ["project", "product", "feature"] as const) {
		it(`${entityType} template has transitions for all states`, () => {
			const t = getTemplate(entityType);
			for (const state of t.states) {
				expect(t.transitions).toHaveProperty(state);
			}
		});

		it(`${entityType} initial state is in states list`, () => {
			const t = getTemplate(entityType);
			expect(t.states).toContain(t.initialState);
		});

		it(`${entityType} terminal states are in states list`, () => {
			const t = getTemplate(entityType);
			for (const ts of t.terminalStates) {
				expect(t.states).toContain(ts);
			}
		});

		it(`${entityType} terminal states have no outgoing transitions`, () => {
			const t = getTemplate(entityType);
			for (const ts of t.terminalStates) {
				expect(t.transitions[ts]).toEqual([]);
			}
		});
	}
});

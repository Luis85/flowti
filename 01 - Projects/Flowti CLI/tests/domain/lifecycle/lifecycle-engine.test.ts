import { describe, it, expect } from "vitest";
import {
	getTemplate, getValidTransitions, validateTransition, isTerminal,
	registerTemplate, loadTemplate, getGates, validateGatedTransition,
} from "../../../src/domain/lifecycle/lifecycle-engine.js";
import type { GateResult } from "../../../src/domain/lifecycle/lifecycle-types.js";

describe("getTemplate", () => {
	it("returns project template", () => {
		const t = getTemplate("project");
		expect(t).toBeDefined();
		expect(t!.entityType).toBe("project");
		expect(t!.initialState).toBe("inception");
		expect(t!.states).toContain("planning");
		expect(t!.terminalStates).toEqual(["archived"]);
	});

	it("returns product template", () => {
		const t = getTemplate("product");
		expect(t).toBeDefined();
		expect(t!.entityType).toBe("product");
		expect(t!.initialState).toBe("concept");
		expect(t!.terminalStates).toEqual(["sunset"]);
	});

	it("returns feature template", () => {
		const t = getTemplate("feature");
		expect(t).toBeDefined();
		expect(t!.entityType).toBe("feature");
		expect(t!.initialState).toBe("ideation");
		expect(t!.terminalStates).toEqual(["deprecated"]);
	});

	it("returns undefined for unknown entity type", () => {
		expect(getTemplate("nonexistent")).toBeUndefined();
	});
});

describe("getValidTransitions", () => {
	it("returns valid transitions for project inception", () => {
		const t = getTemplate("project")!;
		expect(getValidTransitions(t, "inception")).toEqual(["planning"]);
	});

	it("returns multiple transitions for project planning", () => {
		const t = getTemplate("project")!;
		expect(getValidTransitions(t, "planning")).toEqual(["execution", "inception"]);
	});

	it("returns empty array for terminal state", () => {
		const t = getTemplate("project")!;
		expect(getValidTransitions(t, "archived")).toEqual([]);
	});

	it("returns empty array for unknown state", () => {
		const t = getTemplate("project")!;
		expect(getValidTransitions(t, "nonexistent")).toEqual([]);
	});

	it("allows feature testing to go back to development", () => {
		const t = getTemplate("feature")!;
		expect(getValidTransitions(t, "testing")).toEqual(["release", "development"]);
	});
});

describe("validateTransition", () => {
	it("succeeds for valid transition", () => {
		const t = getTemplate("project")!;
		const result = validateTransition(t, "inception", "planning");
		expect(result.success).toBe(true);
		expect(result.from).toBe("inception");
		expect(result.to).toBe("planning");
	});

	it("fails for invalid transition", () => {
		const t = getTemplate("project")!;
		const result = validateTransition(t, "inception", "archived");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot transition");
		expect(result.error).toContain("planning");
	});

	it("fails for unknown source state", () => {
		const t = getTemplate("project")!;
		const result = validateTransition(t, "nonexistent", "planning");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unknown state");
	});

	it("fails for terminal state transition", () => {
		const t = getTemplate("product")!;
		const result = validateTransition(t, "sunset", "concept");
		expect(result.success).toBe(false);
		expect(result.error).toContain("terminal state");
	});
});

describe("isTerminal", () => {
	it("returns true for terminal states", () => {
		expect(isTerminal(getTemplate("project")!, "archived")).toBe(true);
		expect(isTerminal(getTemplate("product")!, "sunset")).toBe(true);
		expect(isTerminal(getTemplate("feature")!, "deprecated")).toBe(true);
	});

	it("returns false for non-terminal states", () => {
		expect(isTerminal(getTemplate("project")!, "inception")).toBe(false);
		expect(isTerminal(getTemplate("product")!, "growth")).toBe(false);
		expect(isTerminal(getTemplate("feature")!, "testing")).toBe(false);
	});
});

describe("lifecycle completeness", () => {
	for (const entityType of ["project", "product", "feature"] as const) {
		it(`${entityType} template has transitions for all states`, () => {
			const t = getTemplate(entityType)!;
			for (const state of t.states) {
				expect(t.transitions).toHaveProperty(state);
			}
		});

		it(`${entityType} initial state is in states list`, () => {
			const t = getTemplate(entityType)!;
			expect(t.states).toContain(t.initialState);
		});

		it(`${entityType} terminal states are in states list`, () => {
			const t = getTemplate(entityType)!;
			for (const ts of t.terminalStates) {
				expect(t.states).toContain(ts);
			}
		});

		it(`${entityType} terminal states have no outgoing transitions`, () => {
			const t = getTemplate(entityType)!;
			for (const ts of t.terminalStates) {
				expect(t.transitions[ts]).toEqual([]);
			}
		});
	}
});

describe("registerTemplate", () => {
	it("registers a custom template", () => {
		registerTemplate({
			entityType: "test-entity",
			states: ["alpha", "beta", "gamma"],
			transitions: { alpha: ["beta"], beta: ["gamma"], gamma: [] },
			initialState: "alpha",
			terminalStates: ["gamma"],
		});
		const t = getTemplate("test-entity");
		expect(t).toBeDefined();
		expect(t!.initialState).toBe("alpha");
		expect(t!.terminalStates).toEqual(["gamma"]);
	});

	it("overwrites an existing template by entityType", () => {
		registerTemplate({
			entityType: "test-entity",
			states: ["x", "y"],
			transitions: { x: ["y"], y: [] },
			initialState: "x",
			terminalStates: ["y"],
		});
		const t = getTemplate("test-entity")!;
		expect(t.states).toEqual(["x", "y"]);
	});
});

describe("loadTemplate", () => {
	const validDef = {
		entityType: "iteration",
		initialState: "new",
		terminalStates: ["done"],
		states: {
			new: { label: "New", transitions: ["planned"] },
			planned: { label: "Planned", transitions: ["done"] },
			done: { label: "Done", transitions: [] },
		},
		gates: {
			new: [{ id: "has-goal", label: "Goal defined" }],
		},
	};

	it("parses a valid definition", () => {
		const t = loadTemplate(validDef);
		expect(t).not.toBeNull();
		expect(t!.entityType).toBe("iteration");
		expect(t!.states).toEqual(["new", "planned", "done"]);
		expect(t!.transitions.new).toEqual(["planned"]);
		expect(t!.initialState).toBe("new");
		expect(t!.terminalStates).toEqual(["done"]);
		expect(t!.labels?.new).toBe("New");
		expect(t!.gates?.new).toEqual([{ id: "has-goal", label: "Goal defined" }]);
	});

	it("returns null for non-object", () => {
		expect(loadTemplate(null)).toBeNull();
		expect(loadTemplate("string")).toBeNull();
		expect(loadTemplate(42)).toBeNull();
	});

	it("returns null for missing entityType", () => {
		expect(loadTemplate({ ...validDef, entityType: undefined })).toBeNull();
	});

	it("returns null for missing initialState", () => {
		expect(loadTemplate({ ...validDef, initialState: undefined })).toBeNull();
	});

	it("returns null for invalid terminalStates", () => {
		expect(loadTemplate({ ...validDef, terminalStates: "done" })).toBeNull();
	});

	it("returns null for missing states", () => {
		expect(loadTemplate({ ...validDef, states: undefined })).toBeNull();
	});

	it("returns null for initialState not in states", () => {
		expect(loadTemplate({ ...validDef, initialState: "nonexistent" })).toBeNull();
	});

	it("parses definition without gates", () => {
		const { gates: _, ...noGates } = validDef;
		const t = loadTemplate(noGates);
		expect(t).not.toBeNull();
		expect(t!.gates).toBeUndefined();
	});
});

describe("getGates", () => {
	it("returns gate definitions for a state", () => {
		const t = loadTemplate({
			entityType: "test-gates",
			initialState: "a",
			terminalStates: ["b"],
			states: { a: { label: "A", transitions: ["b"] }, b: { label: "B", transitions: [] } },
			gates: { a: [{ id: "gate-1", label: "Gate One" }] },
		})!;
		expect(getGates(t, "a")).toEqual([{ id: "gate-1", label: "Gate One" }]);
	});

	it("returns empty array for state without gates", () => {
		const t = getTemplate("project")!;
		expect(getGates(t, "inception")).toEqual([]);
	});

	it("returns empty array for unknown state", () => {
		const t = getTemplate("project")!;
		expect(getGates(t, "nonexistent")).toEqual([]);
	});
});

describe("validateGatedTransition", () => {
	const template = loadTemplate({
		entityType: "gated-test",
		initialState: "draft",
		terminalStates: ["released"],
		states: {
			draft: { label: "Draft", transitions: ["review"] },
			review: { label: "Review", transitions: ["released"] },
			released: { label: "Released", transitions: [] },
		},
		gates: {
			draft: [{ id: "has-content", label: "Content exists" }, { id: "has-author", label: "Author set" }],
		},
	})!;

	it("succeeds when all gates pass", () => {
		const evaluator = (id: string): GateResult => ({ gateId: id, passed: true });
		const result = validateGatedTransition(template, "draft", "review", evaluator);
		expect(result.success).toBe(true);
		expect(result.gateResults).toHaveLength(2);
		expect(result.gateResults!.every((r) => r.passed)).toBe(true);
	});

	it("fails when a gate fails", () => {
		const evaluator = (id: string): GateResult =>
			id === "has-content" ? { gateId: id, passed: false, message: "No content" } : { gateId: id, passed: true };
		const result = validateGatedTransition(template, "draft", "review", evaluator);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Gates failed");
		expect(result.error).toContain("No content");
		expect(result.gateResults).toHaveLength(2);
	});

	it("fails when transition itself is invalid", () => {
		const evaluator = (): GateResult => ({ gateId: "x", passed: true });
		const result = validateGatedTransition(template, "draft", "released", evaluator);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot transition");
		expect(result.gateResults).toBeUndefined();
	});

	it("succeeds with no gates on the source state", () => {
		const evaluator = (): GateResult => ({ gateId: "x", passed: false });
		const result = validateGatedTransition(template, "review", "released", evaluator);
		expect(result.success).toBe(true);
		expect(result.gateResults).toEqual([]);
	});
});

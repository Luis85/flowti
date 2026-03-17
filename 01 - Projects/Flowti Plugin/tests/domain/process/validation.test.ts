import { describe, it, expect } from "vitest";
import {
	checkHasNodes,
	checkSingleStart,
	checkHasEnd,
	checkStartHasOutgoing,
	checkEndNoOutgoing,
	checkNoDisconnected,
	checkNoDeadEnds,
	checkNoOrphanEdges,
	checkUniqueNodeIds,
	checkDecisionBranching,
	validateProcess,
} from "../../../src/domain/process/validation";
import type { ProcessDefinition, ProcessNode, ProcessEdge } from "../../../src/domain/process/types";

// ── Test helpers ────────────────────────────────────────────

function makeNode(id: string, type: ProcessNode["type"], name: string = type): ProcessNode {
	return { id, type, name, metadata: {}, x: 0, y: 0 };
}

function makeDef(nodes: ProcessNode[], edges: ProcessEdge[] = []): ProcessDefinition {
	return { name: "Test", filePath: "test.canvas", nodes, edges };
}

/** A valid linear process: Start → Activity → End */
function validLinearProcess(): ProcessDefinition {
	return makeDef(
		[makeNode("s1", "start", "Start"), makeNode("a1", "activity", "Do Work"), makeNode("e1", "end", "End")],
		[{ fromNode: "s1", toNode: "a1" }, { fromNode: "a1", toNode: "e1" }],
	);
}

// ── PM-STRUCT-001: Process must contain nodes ───────────────

describe("checkHasNodes (PM-STRUCT-001)", () => {
	it("passes with nodes", () => {
		expect(checkHasNodes(validLinearProcess())).toEqual([]);
	});

	it("fails with no nodes", () => {
		const findings = checkHasNodes(makeDef([]));
		expect(findings).toHaveLength(1);
		expect(findings[0].ruleId).toBe("PM-STRUCT-001");
		expect(findings[0].severity).toBe("error");
	});
});

// ── PM-STRUCT-002: Exactly one Start node ───────────────────

describe("checkSingleStart (PM-STRUCT-002)", () => {
	it("passes with exactly one start", () => {
		expect(checkSingleStart(validLinearProcess())).toEqual([]);
	});

	it("fails with no start", () => {
		const def = makeDef([makeNode("a1", "activity"), makeNode("e1", "end")]);
		const findings = checkSingleStart(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].ruleId).toBe("PM-STRUCT-002");
	});

	it("fails with multiple starts", () => {
		const def = makeDef([
			makeNode("s1", "start", "Start A"),
			makeNode("s2", "start", "Start B"),
			makeNode("e1", "end"),
		]);
		const findings = checkSingleStart(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].nodeId).toBe("s2");
	});
});

// ── PM-STRUCT-003: At least one End node ────────────────────

describe("checkHasEnd (PM-STRUCT-003)", () => {
	it("passes with end node", () => {
		expect(checkHasEnd(validLinearProcess())).toEqual([]);
	});

	it("fails with no end node", () => {
		const def = makeDef([makeNode("s1", "start"), makeNode("a1", "activity")]);
		const findings = checkHasEnd(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].ruleId).toBe("PM-STRUCT-003");
	});
});

// ── PM-STRUCT-004: Start must have outgoing edges ───────────

describe("checkStartHasOutgoing (PM-STRUCT-004)", () => {
	it("passes when start has outgoing", () => {
		expect(checkStartHasOutgoing(validLinearProcess())).toEqual([]);
	});

	it("fails when start has no outgoing", () => {
		const def = makeDef(
			[makeNode("s1", "start", "Start"), makeNode("e1", "end")],
			[],
		);
		const findings = checkStartHasOutgoing(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].ruleId).toBe("PM-STRUCT-004");
		expect(findings[0].nodeId).toBe("s1");
	});
});

// ── PM-STRUCT-005: End must have no outgoing edges ──────────

describe("checkEndNoOutgoing (PM-STRUCT-005)", () => {
	it("passes when end has no outgoing", () => {
		expect(checkEndNoOutgoing(validLinearProcess())).toEqual([]);
	});

	it("fails when end has outgoing", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("e1", "end", "End")],
			[{ fromNode: "s1", toNode: "e1" }, { fromNode: "e1", toNode: "s1" }],
		);
		const findings = checkEndNoOutgoing(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].ruleId).toBe("PM-STRUCT-005");
		expect(findings[0].nodeId).toBe("e1");
	});
});

// ── PM-STRUCT-006: No disconnected nodes ────────────────────

describe("checkNoDisconnected (PM-STRUCT-006)", () => {
	it("passes when all nodes connected", () => {
		expect(checkNoDisconnected(validLinearProcess())).toEqual([]);
	});

	it("fails with disconnected node", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("a1", "activity", "Orphan"), makeNode("e1", "end")],
			[{ fromNode: "s1", toNode: "e1" }],
		);
		const findings = checkNoDisconnected(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].nodeId).toBe("a1");
	});

	it("passes for single-node process", () => {
		expect(checkNoDisconnected(makeDef([makeNode("s1", "start")]))).toEqual([]);
	});
});

// ── PM-STRUCT-007: No dead ends ─────────────────────────────

describe("checkNoDeadEnds (PM-STRUCT-007)", () => {
	it("passes for valid linear process", () => {
		expect(checkNoDeadEnds(validLinearProcess())).toEqual([]);
	});

	it("warns for activity with incoming but no outgoing", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("a1", "activity", "Dead End"), makeNode("e1", "end")],
			[{ fromNode: "s1", toNode: "a1" }],
		);
		const findings = checkNoDeadEnds(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe("warning");
		expect(findings[0].nodeId).toBe("a1");
	});

	it("does not flag disconnected nodes (handled by PM-STRUCT-006)", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("a1", "activity", "Disconnected"), makeNode("e1", "end")],
			[{ fromNode: "s1", toNode: "e1" }],
		);
		expect(checkNoDeadEnds(def)).toEqual([]);
	});
});

// ── PM-STRUCT-008: No orphan edges ──────────────────────────

describe("checkNoOrphanEdges (PM-STRUCT-008)", () => {
	it("passes with valid edges", () => {
		expect(checkNoOrphanEdges(validLinearProcess())).toEqual([]);
	});

	it("fails with edge referencing missing source", () => {
		const def = makeDef(
			[makeNode("e1", "end")],
			[{ fromNode: "missing", toNode: "e1" }],
		);
		const findings = checkNoOrphanEdges(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].message).toContain("missing");
	});

	it("fails with edge referencing missing target", () => {
		const def = makeDef(
			[makeNode("s1", "start")],
			[{ fromNode: "s1", toNode: "missing" }],
		);
		const findings = checkNoOrphanEdges(def);
		expect(findings).toHaveLength(1);
	});
});

// ── PM-STRUCT-009: Unique node IDs ──────────────────────────

describe("checkUniqueNodeIds (PM-STRUCT-009)", () => {
	it("passes with unique IDs", () => {
		expect(checkUniqueNodeIds(validLinearProcess())).toEqual([]);
	});

	it("fails with duplicate IDs", () => {
		const def = makeDef([makeNode("s1", "start"), makeNode("s1", "activity")]);
		const findings = checkUniqueNodeIds(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].ruleId).toBe("PM-STRUCT-009");
	});
});

// ── PM-TYPE-005: Decision branching ─────────────────────────

describe("checkDecisionBranching (PM-TYPE-005)", () => {
	it("passes when decision has ≥ 2 outgoing edges", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("d1", "decision", "Check"), makeNode("a1", "activity"), makeNode("e1", "end")],
			[
				{ fromNode: "s1", toNode: "d1" },
				{ fromNode: "d1", toNode: "a1", label: "Yes" },
				{ fromNode: "d1", toNode: "e1", label: "No" },
			],
		);
		expect(checkDecisionBranching(def)).toEqual([]);
	});

	it("warns when decision has < 2 outgoing edges", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("d1", "decision", "Check"), makeNode("e1", "end")],
			[{ fromNode: "s1", toNode: "d1" }, { fromNode: "d1", toNode: "e1" }],
		);
		const findings = checkDecisionBranching(def);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe("warning");
		expect(findings[0].nodeId).toBe("d1");
	});

	it("passes when no decision nodes exist", () => {
		expect(checkDecisionBranching(validLinearProcess())).toEqual([]);
	});
});

// ── validateProcess (aggregate) ─────────────────────────────

describe("validateProcess", () => {
	it("valid process returns no errors", () => {
		const result = validateProcess(validLinearProcess());
		expect(result.valid).toBe(true);
		expect(result.errorCount).toBe(0);
	});

	it("empty process returns errors", () => {
		const result = validateProcess(makeDef([]));
		expect(result.valid).toBe(false);
		expect(result.errorCount).toBeGreaterThan(0);
	});

	it("counts errors, warnings, info separately", () => {
		const def = makeDef(
			[makeNode("s1", "start"), makeNode("d1", "decision", "Check"), makeNode("e1", "end")],
			[{ fromNode: "s1", toNode: "d1" }, { fromNode: "d1", toNode: "e1" }],
		);
		const result = validateProcess(def);
		// Decision branching warning (< 2 outgoing)
		expect(result.warningCount).toBeGreaterThanOrEqual(1);
		expect(result.valid).toBe(true); // warnings don't make it invalid
	});

	it("aggregates findings from all rules", () => {
		const result = validateProcess(makeDef([]));
		// At minimum: no nodes, no start, no end
		expect(result.findings.length).toBeGreaterThanOrEqual(3);
	});
});

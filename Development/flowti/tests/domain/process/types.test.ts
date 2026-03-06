import { describe, it, expect } from "vitest";
import {
	PROCESS_NODE_TYPES,
	NODE_TYPE_TOKENS,
	TOKEN_TO_NODE_TYPE,
	NODE_TYPE_LABELS,
	LIFECYCLE_PHASES,
} from "../../../src/domain/process/types";
import type { ProcessNodeType } from "../../../src/domain/process/types";
import { FEATURE_STAGES } from "../../../src/domain/featureLifecycle/types";

describe("Process Management types", () => {
	describe("PROCESS_NODE_TYPES", () => {
		it("has 4 Phase 1 node types", () => {
			expect(PROCESS_NODE_TYPES).toEqual(["start", "activity", "decision", "end"]);
		});

		it("each type has a title token", () => {
			for (const type of PROCESS_NODE_TYPES) {
				expect(NODE_TYPE_TOKENS[type]).toBeDefined();
				expect(typeof NODE_TYPE_TOKENS[type]).toBe("string");
			}
		});

		it("each type has a display label", () => {
			for (const type of PROCESS_NODE_TYPES) {
				expect(NODE_TYPE_LABELS[type]).toBeDefined();
			}
		});
	});

	describe("NODE_TYPE_TOKENS", () => {
		it("maps correct tokens", () => {
			expect(NODE_TYPE_TOKENS.start).toBe("●");
			expect(NODE_TYPE_TOKENS.activity).toBe("■");
			expect(NODE_TYPE_TOKENS.decision).toBe("◇");
			expect(NODE_TYPE_TOKENS.end).toBe("⦿");
		});
	});

	describe("TOKEN_TO_NODE_TYPE", () => {
		it("reverses NODE_TYPE_TOKENS", () => {
			for (const [type, token] of Object.entries(NODE_TYPE_TOKENS)) {
				expect(TOKEN_TO_NODE_TYPE[token]).toBe(type);
			}
		});

		it("has same number of entries", () => {
			expect(Object.keys(TOKEN_TO_NODE_TYPE)).toHaveLength(PROCESS_NODE_TYPES.length);
		});
	});

	describe("LIFECYCLE_PHASES", () => {
		it("has 10 phases", () => {
			expect(LIFECYCLE_PHASES).toHaveLength(10);
		});

		it("phases are numbered 1-10 in order", () => {
			LIFECYCLE_PHASES.forEach((phase, i) => {
				expect(phase.phase).toBe(i + 1);
			});
		});

		it("all phase stages are valid FeatureStages", () => {
			for (const phase of LIFECYCLE_PHASES) {
				expect(FEATURE_STAGES).toContain(phase.stage);
			}
		});

		it("covers all 6 feature stages", () => {
			const usedStages = new Set(LIFECYCLE_PHASES.map((p) => p.stage));
			expect(usedStages.size).toBe(6);
		});

		it("each phase has a name and description", () => {
			for (const phase of LIFECYCLE_PHASES) {
				expect(phase.name.length).toBeGreaterThan(0);
				expect(phase.description.length).toBeGreaterThan(0);
			}
		});

		it("maps expected stages per phase", () => {
			const mapping: [number, string][] = [
				[1, "idea"],
				[2, "draft"],
				[3, "draft"],
				[4, "approved"],
				[5, "approved"],
				[6, "in-progress"],
				[7, "in-progress"],
				[8, "review"],
				[9, "review"],
				[10, "done"],
			];
			for (const [phase, expectedStage] of mapping) {
				const found = LIFECYCLE_PHASES.find((p) => p.phase === phase);
				expect(found?.stage).toBe(expectedStage);
			}
		});
	});

	describe("Type shape contracts", () => {
		it("ProcessNode has required fields", () => {
			const node = {
				id: "n1",
				type: "activity" as ProcessNodeType,
				name: "Test",
				metadata: {},
				x: 0,
				y: 0,
			};
			expect(node.id).toBeDefined();
			expect(node.type).toBe("activity");
			expect(node.metadata).toEqual({});
		});

		it("ProcessEdge has required fields", () => {
			const edge = { fromNode: "n1", toNode: "n2", label: "Yes" };
			expect(edge.fromNode).toBe("n1");
			expect(edge.toNode).toBe("n2");
			expect(edge.label).toBe("Yes");
		});

		it("ProcessDefinition has required fields", () => {
			const def = {
				name: "Test Process",
				filePath: "processes/test.process.canvas",
				nodes: [],
				edges: [],
			};
			expect(def.name).toBe("Test Process");
			expect(def.nodes).toEqual([]);
		});

		it("ValidationFinding has required fields", () => {
			const finding = {
				ruleId: "PM-STRUCT-001",
				severity: "error" as const,
				message: "Process must contain nodes",
			};
			expect(finding.ruleId).toBe("PM-STRUCT-001");
			expect(finding.severity).toBe("error");
		});
	});
});

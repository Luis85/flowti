import { describe, it, expect } from "vitest";
import {
	generateDevelopmentLifecycle,
	generateDevelopmentLifecycleCanvas,
} from "../../../src/domain/process/referenceProcess";
import { validateProcess } from "../../../src/domain/process/validation";
import { parseProcessCanvas } from "../../../src/domain/process/canvasParser";
import { LIFECYCLE_PHASES } from "../../../src/domain/process/types";

describe("referenceProcess", () => {
	describe("generateDevelopmentLifecycle", () => {
		it("produces a valid ProcessDefinition", () => {
			const def = generateDevelopmentLifecycle();
			const result = validateProcess(def);
			expect(result.valid).toBe(true);
			expect(result.errorCount).toBe(0);
		});

		it("contains all 10 lifecycle phases", () => {
			const def = generateDevelopmentLifecycle();
			expect(def.nodes).toHaveLength(10);
			for (const lp of LIFECYCLE_PHASES) {
				expect(def.nodes.find(n => n.name === lp.name)).toBeDefined();
			}
		});

		it("uses all 4 node types", () => {
			const def = generateDevelopmentLifecycle();
			const types = new Set(def.nodes.map(n => n.type));
			expect(types).toEqual(new Set(["start", "activity", "decision", "end"]));
		});

		it("has exactly 1 start and 1 end", () => {
			const def = generateDevelopmentLifecycle();
			expect(def.nodes.filter(n => n.type === "start")).toHaveLength(1);
			expect(def.nodes.filter(n => n.type === "end")).toHaveLength(1);
		});

		it("has 2 decision gates", () => {
			const def = generateDevelopmentLifecycle();
			expect(def.nodes.filter(n => n.type === "decision")).toHaveLength(2);
		});

		it("includes rework edges from decision nodes", () => {
			const def = generateDevelopmentLifecycle();
			const reworkEdges = def.edges.filter(e => e.label === "Rework");
			expect(reworkEdges).toHaveLength(2);
		});

		it("every node has phase metadata", () => {
			const def = generateDevelopmentLifecycle();
			for (const node of def.nodes) {
				expect(node.metadata.phase).toBeGreaterThanOrEqual(1);
				expect(node.metadata.phase).toBeLessThanOrEqual(10);
				expect(node.metadata.role).toBeDefined();
			}
		});
	});

	describe("generateDevelopmentLifecycleCanvas", () => {
		it("produces valid JSON that parses as a process canvas", () => {
			const json = generateDevelopmentLifecycleCanvas();
			const canvas = JSON.parse(json);
			expect(canvas.nodes).toHaveLength(10);
			expect(canvas.edges).toHaveLength(11);
		});

		it("round-trips through canvasParser and passes validation", () => {
			const json = generateDevelopmentLifecycleCanvas();
			const canvas = JSON.parse(json);
			const def = parseProcessCanvas(canvas, "Dev Lifecycle", "test.canvas");
			expect(def).toBeDefined();
			const result = validateProcess(def!);
			expect(result.valid).toBe(true);
		});

		it("canvas nodes contain token prefixes", () => {
			const json = generateDevelopmentLifecycleCanvas();
			const canvas = JSON.parse(json);
			const texts: string[] = canvas.nodes.map((n: { text: string }) => n.text);
			expect(texts.some(t => t.startsWith("●"))).toBe(true);
			expect(texts.some(t => t.startsWith("■"))).toBe(true);
			expect(texts.some(t => t.startsWith("◇"))).toBe(true);
			expect(texts.some(t => t.startsWith("⦿"))).toBe(true);
		});
	});
});

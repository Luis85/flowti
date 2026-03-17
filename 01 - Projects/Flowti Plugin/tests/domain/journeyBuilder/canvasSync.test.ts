import { describe, it, expect, beforeEach } from "vitest";
import { buildJourneyCanvas, type CanvasSyncInput } from "../../../src/domain/journeyBuilder/canvasSync";

// ── Helpers ─────────────────────────────────────────────────────────

let idCounter = 0;
function deterministicId(): string {
	return `id-${++idCounter}`;
}

function sampleInput(overrides?: Partial<CanvasSyncInput>): CanvasSyncInput {
	return {
		journey: "My Journey",
		description: "A test journey",
		startEvent: "app.opened",
		endEvent: "app.closed",
		steps: [
			{ id: "step-1", title: "Open the hub", description: "Opens the hub view", actions: [{ tool: "command" }, { tool: "wait" }] },
			{ id: "step-2", title: "Click the button", description: "", actions: [{ tool: "click" }] },
		],
		...overrides,
	};
}

function resetIds(): void {
	idCounter = 0;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("buildJourneyCanvas", () => {
	beforeEach(() => resetIds());

	describe("structure", () => {
		it("returns an object with nodes and edges arrays", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			expect(result).toHaveProperty("nodes");
			expect(result).toHaveProperty("edges");
			expect(Array.isArray(result.nodes)).toBe(true);
			expect(Array.isArray(result.edges)).toBe(true);
		});

		it("all node IDs are unique", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const ids = result.nodes.map((n) => n.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("all edge IDs are unique", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const ids = result.edges.map((e) => e.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("uses custom idGenerator when provided", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			expect(result.nodes[0].id).toBe("id-1");
			expect(result.nodes[1].id).toBe("id-2");
		});
	});

	describe("START node", () => {
		it("generates a text node with Start in text", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const startNode = result.nodes[0];
			expect(startNode.type).toBe("text");
			expect((startNode as { text: string }).text).toContain("Start");
		});

		it("includes startEvent in START node text", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const startNode = result.nodes[0] as { text: string };
			expect(startNode.text).toContain("app.opened");
		});

		it("has color 4 (green)", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			expect((result.nodes[0] as { color?: string }).color).toBe("4");
		});

		it("is positioned at x=0", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			expect(result.nodes[0].x).toBe(0);
		});

		it("handles empty startEvent gracefully", () => {
			const result = buildJourneyCanvas(sampleInput({ startEvent: "" }), deterministicId);
			const startNode = result.nodes[0] as { text: string };
			expect(startNode.text).toContain("Start");
			expect(startNode.text).not.toContain("\n");
		});
	});

	describe("END node", () => {
		it("generates a text node with End in text", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const endNode = result.nodes[result.nodes.length - 1];
			expect(endNode.type).toBe("text");
			expect((endNode as { text: string }).text).toContain("End");
		});

		it("includes endEvent in END node text", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const endNode = result.nodes[result.nodes.length - 1] as { text: string };
			expect(endNode.text).toContain("app.closed");
		});

		it("has color 1 (red)", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const endNode = result.nodes[result.nodes.length - 1] as { color?: string };
			expect(endNode.color).toBe("1");
		});

		it("is positioned rightmost", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const endNode = result.nodes[result.nodes.length - 1];
			const startNode = result.nodes[0];
			expect(endNode.x).toBeGreaterThan(startNode.x);
		});

		it("handles empty endEvent gracefully", () => {
			const result = buildJourneyCanvas(sampleInput({ endEvent: "" }), deterministicId);
			const endNode = result.nodes[result.nodes.length - 1] as { text: string };
			expect(endNode.text).toContain("End");
			expect(endNode.text).not.toContain("\n");
		});
	});

	describe("step groups", () => {
		it("generates one group node per step", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect(groups).toHaveLength(2);
		});

		it("group label matches step title", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[0] as { label: string }).label).toBe("Open the hub");
			expect((groups[1] as { label: string }).label).toBe("Click the button");
		});

		it("falls back to Step N when title is empty", () => {
			const input = sampleInput({
				steps: [{ id: "s1", title: "", description: "", actions: [] }],
			});
			const result = buildJourneyCanvas(input, deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[0] as { label: string }).label).toBe("Step 1");
		});

		it("inner text node shows description and action count", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const textNodes = result.nodes.filter((n) => n.type === "text");
			// textNodes: START, inner1, inner2, END
			const inner1 = textNodes[1] as { text: string };
			expect(inner1.text).toContain("Opens the hub view");
			expect(inner1.text).toContain("2 actions");
		});

		it("inner text shows singular action for 1 action", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const textNodes = result.nodes.filter((n) => n.type === "text");
			const inner2 = textNodes[2] as { text: string };
			expect(inner2.text).toContain("1 action");
			expect(inner2.text).not.toContain("1 actions");
		});

		it("inner text shows action count only when no description", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const textNodes = result.nodes.filter((n) => n.type === "text");
			// step-2 has no description
			const inner2 = textNodes[2] as { text: string };
			expect(inner2.text).toBe("1 action");
		});

		it("steps progress rightward from START", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect(groups[0].x).toBeGreaterThan(result.nodes[0].x);
			expect(groups[1].x).toBeGreaterThan(groups[0].x);
		});
	});

	describe("edges", () => {
		it("connects START → steps → END in sequence", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			// With 2 steps: START → Step1 → Step2 → END = 3 edges
			expect(result.edges).toHaveLength(3);
		});

		it("uses right-to-left edge sides for left-to-right flow", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			for (const edge of result.edges) {
				expect(edge.fromSide).toBe("right");
				expect(edge.toSide).toBe("left");
			}
		});

		it("edges have arrow on toEnd", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			for (const edge of result.edges) {
				expect(edge.toEnd).toBe("arrow");
				expect(edge.fromEnd).toBe("none");
			}
		});

		it("first edge connects START to first step group", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const startId = result.nodes[0].id;
			const firstGroup = result.nodes.find((n) => n.type === "group")!;
			expect(result.edges[0].fromNode).toBe(startId);
			expect(result.edges[0].toNode).toBe(firstGroup.id);
		});

		it("last edge connects last step group to END", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const endNode = result.nodes[result.nodes.length - 1];
			const groups = result.nodes.filter((n) => n.type === "group");
			const lastEdge = result.edges[result.edges.length - 1];
			expect(lastEdge.fromNode).toBe(groups[groups.length - 1].id);
			expect(lastEdge.toNode).toBe(endNode.id);
		});
	});

	describe("active step highlight", () => {
		it("colors the active step group with '5' (cyan)", () => {
			const result = buildJourneyCanvas(sampleInput({ activeStepIndex: 0 }), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[0] as { color?: string }).color).toBe("5");
		});

		it("leaves non-active step groups without color", () => {
			const result = buildJourneyCanvas(sampleInput({ activeStepIndex: 0 }), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[1] as { color?: string }).color).toBeUndefined();
		});

		it("all step groups uncolored when activeStepIndex is omitted", () => {
			const result = buildJourneyCanvas(sampleInput(), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			for (const g of groups) {
				expect((g as { color?: string }).color).toBeUndefined();
			}
		});

		it("ignores out-of-range activeStepIndex", () => {
			const result = buildJourneyCanvas(sampleInput({ activeStepIndex: 99 }), deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			for (const g of groups) {
				expect((g as { color?: string }).color).toBeUndefined();
			}
		});
	});

	describe("edge cases", () => {
		it("works with zero steps (START → END only)", () => {
			const input = sampleInput({ steps: [] });
			const result = buildJourneyCanvas(input, deterministicId);
			expect(result.nodes.filter((n) => n.type === "text")).toHaveLength(2); // START + END
			expect(result.nodes.filter((n) => n.type === "group")).toHaveLength(0);
			expect(result.edges).toHaveLength(1); // START → END
		});

		it("works with a single step", () => {
			const input = sampleInput({
				steps: [{ id: "s1", title: "Only step", description: "", actions: [] }],
			});
			const result = buildJourneyCanvas(input, deterministicId);
			expect(result.nodes.filter((n) => n.type === "group")).toHaveLength(1);
			expect(result.edges).toHaveLength(2); // START → Step → END
		});

		it("works with many steps (5+)", () => {
			const input = sampleInput({
				steps: Array.from({ length: 5 }, (_, i) => ({
					id: `s${i}`,
					title: `Step ${i + 1}`,
					description: "",
					actions: [],
				})),
			});
			const result = buildJourneyCanvas(input, deterministicId);
			expect(result.nodes.filter((n) => n.type === "group")).toHaveLength(5);
			expect(result.edges).toHaveLength(6); // START → 5 steps → END
		});

		it("handles step with no actions array", () => {
			const input = sampleInput({
				steps: [{ id: "s1", title: "No actions", description: "", actions: [] }],
			});
			const result = buildJourneyCanvas(input, deterministicId);
			const textNodes = result.nodes.filter((n) => n.type === "text");
			const inner = textNodes[1] as { text: string };
			expect(inner.text).toContain("0 actions");
		});
	});

	describe("stepColors", () => {
		it("applies stepColors to corresponding step groups", () => {
			const input = sampleInput({ stepColors: { 0: "4", 1: "1" } });
			const result = buildJourneyCanvas(input, deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[0] as { color?: string }).color).toBe("4");
			expect((groups[1] as { color?: string }).color).toBe("1");
		});

		it("stepColors takes precedence over activeStepIndex", () => {
			const input = sampleInput({ activeStepIndex: 0, stepColors: { 0: "1" } });
			const result = buildJourneyCanvas(input, deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[0] as { color?: string }).color).toBe("1");
		});

		it("steps without stepColors entry fall back to activeStepIndex", () => {
			const input = sampleInput({ activeStepIndex: 1, stepColors: { 0: "4" } });
			const result = buildJourneyCanvas(input, deterministicId);
			const groups = result.nodes.filter((n) => n.type === "group");
			expect((groups[0] as { color?: string }).color).toBe("4");
			expect((groups[1] as { color?: string }).color).toBe("5");
		});
	});

	describe("background image", () => {
		it("sets background on group node when step has backgroundImage", () => {
			const input = sampleInput({
				steps: [
					{ id: "step-1", title: "Step 1", description: "", actions: [], backgroundImage: "assets/mockup.png" },
				],
			});
			const result = buildJourneyCanvas(input, deterministicId);
			const group = result.nodes.find((n) => n.type === "group");
			expect((group as Record<string, unknown>).background).toBe("assets/mockup.png");
			expect((group as Record<string, unknown>).backgroundStyle).toBe("cover");
		});

		it("omits background when step has no backgroundImage", () => {
			const input = sampleInput();
			const result = buildJourneyCanvas(input, deterministicId);
			const group = result.nodes.find((n) => n.type === "group");
			expect((group as Record<string, unknown>).background).toBeUndefined();
			expect((group as Record<string, unknown>).backgroundStyle).toBeUndefined();
		});
	});
});

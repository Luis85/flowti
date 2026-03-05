import { describe, it, expect, beforeEach } from "vitest";
import { isJourneyCanvas, parseJourneyCanvas } from "../../../src/domain/journeyBuilder/canvasParser";
import { buildJourneyCanvas, type CanvasSyncInput } from "../../../src/domain/journeyBuilder/canvasSync";
import type { AllCanvasNodeData, CanvasData, CanvasEdgeData } from "obsidian/canvas";

// ── Helpers ─────────────────────────────────────────────────────────

let idCounter = 0;
function deterministicId(): string {
	return `id-${++idCounter}`;
}
function resetIds(): void {
	idCounter = 0;
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

function textNode(id: string, text: string, x: number, y: number, w = 160, h = 80, color?: string): AllCanvasNodeData {
	return { id, type: "text", text, x, y, width: w, height: h, ...(color ? { color } : {}) } as AllCanvasNodeData;
}

function groupNode(id: string, label: string, x: number, y: number, w = 480, h = 160, color?: string): AllCanvasNodeData {
	return { id, type: "group", label, x, y, width: w, height: h, ...(color ? { color } : {}) } as AllCanvasNodeData;
}

function edge(id: string, from: string, to: string): CanvasEdgeData {
	return { id, fromNode: from, toNode: to, fromSide: "right", toSide: "left", fromEnd: "none", toEnd: "arrow" } as CanvasEdgeData;
}

/** Build a minimal journey canvas manually. */
function minimalCanvas(opts?: {
	startText?: string;
	endText?: string;
	startColor?: string;
	endColor?: string;
	groups?: Array<{ id: string; label: string; color?: string; innerText?: string }>;
	extraNodes?: AllCanvasNodeData[];
	edgeOverrides?: CanvasEdgeData[];
}): CanvasData {
	const o = opts ?? {};
	const startId = "start";
	const endId = "end";
	const nodes: AllCanvasNodeData[] = [
		textNode(startId, o.startText ?? "▶ Start\nmy.event", 0, 0, 160, 80, o.startColor ?? "4"),
	];
	const edges: CanvasEdgeData[] = o.edgeOverrides ?? [];

	let prevId = startId;
	let edgeCounter = 0;
	for (const g of o.groups ?? []) {
		const gx = nodes.length * 520;
		nodes.push(groupNode(g.id, g.label, gx, -40, 480, 160, g.color));
		// Inner text
		if (g.innerText !== undefined) {
			nodes.push(textNode(`${g.id}-inner`, g.innerText, gx + 50, 10, 380, 60));
		}
		if (!o.edgeOverrides) {
			edges.push(edge(`e${++edgeCounter}`, prevId, g.id));
			prevId = g.id;
		}
	}

	nodes.push(textNode(endId, o.endText ?? "⏹ End\nmy.end", nodes.length * 520, 0, 160, 80, o.endColor ?? "1"));
	if (!o.edgeOverrides) {
		edges.push(edge(`e${++edgeCounter}`, prevId, endId));
	}

	if (o.extraNodes) nodes.push(...o.extraNodes);

	return { nodes, edges };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("isJourneyCanvas", () => {
	beforeEach(() => resetIds());

	it("returns true for valid journey canvas", () => {
		const canvas = buildJourneyCanvas(sampleInput(), deterministicId);
		expect(isJourneyCanvas(canvas)).toBe(true);
	});

	it("returns false when START node is missing", () => {
		const canvas = minimalCanvas({ startColor: "6" }); // wrong color
		expect(isJourneyCanvas(canvas)).toBe(false);
	});

	it("returns false when END node is missing", () => {
		const canvas = minimalCanvas({ endColor: "6" }); // wrong color
		expect(isJourneyCanvas(canvas)).toBe(false);
	});

	it("returns false for empty canvas", () => {
		expect(isJourneyCanvas({ nodes: [], edges: [] })).toBe(false);
	});
});

describe("parseJourneyCanvas — events", () => {
	beforeEach(() => resetIds());

	it("extracts startEvent and endEvent", () => {
		const canvas = buildJourneyCanvas(sampleInput(), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.startEvent).toBe("app.opened");
		expect(result.endEvent).toBe("app.closed");
	});

	it("returns empty startEvent when START has no second line", () => {
		const canvas = buildJourneyCanvas(sampleInput({ startEvent: "" }), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.startEvent).toBe("");
	});

	it("returns empty endEvent when END has no second line", () => {
		const canvas = buildJourneyCanvas(sampleInput({ endEvent: "" }), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.endEvent).toBe("");
	});
});

describe("parseJourneyCanvas — steps", () => {
	beforeEach(() => resetIds());

	it("extracts a single step", () => {
		const input = sampleInput({
			steps: [{ id: "s1", title: "Only step", description: "Does one thing", actions: [{ tool: "wait" }] }],
		});
		const canvas = buildJourneyCanvas(input, deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps).toHaveLength(1);
		expect(result.steps[0].title).toBe("Only step");
	});

	it("extracts multiple steps in correct order", () => {
		const canvas = buildJourneyCanvas(sampleInput(), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps).toHaveLength(2);
		expect(result.steps[0].title).toBe("Open the hub");
		expect(result.steps[1].title).toBe("Click the button");
	});

	it("returns empty steps when START connects directly to END", () => {
		const canvas = buildJourneyCanvas(sampleInput({ steps: [] }), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps).toHaveLength(0);
	});

	it("uses group label as step title", () => {
		const canvas = minimalCanvas({
			groups: [{ id: "g1", label: "Custom Title", innerText: "2 actions" }],
		});
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps[0].title).toBe("Custom Title");
	});
});

describe("parseJourneyCanvas — inner text", () => {
	beforeEach(() => resetIds());

	it("extracts description and action count", () => {
		const canvas = buildJourneyCanvas(sampleInput(), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps[0].description).toBe("Opens the hub view");
		expect(result.steps[0].actionCount).toBe(2);
	});

	it("extracts action count when no description", () => {
		const canvas = buildJourneyCanvas(sampleInput(), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		// step-2 has empty description, 1 action
		expect(result.steps[1].description).toBe("");
		expect(result.steps[1].actionCount).toBe(1);
	});

	it("returns actionCount 0 when inner text has no action line", () => {
		const canvas = minimalCanvas({
			groups: [{ id: "g1", label: "Step", innerText: "Just a description" }],
		});
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps[0].actionCount).toBe(0);
		expect(result.steps[0].description).toBe("Just a description");
	});

	it("preserves multi-line description", () => {
		const canvas = minimalCanvas({
			groups: [{ id: "g1", label: "Step", innerText: "Line one\nLine two\n3 actions" }],
		});
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps[0].description).toBe("Line one\nLine two");
		expect(result.steps[0].actionCount).toBe(3);
	});
});

describe("parseJourneyCanvas — active step", () => {
	beforeEach(() => resetIds());

	it("detects first step as active (color 5)", () => {
		const canvas = buildJourneyCanvas(sampleInput({ activeStepIndex: 0 }), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.activeStepIndex).toBe(0);
	});

	it("detects middle step as active", () => {
		const input = sampleInput({
			activeStepIndex: 1,
			steps: [
				{ id: "s1", title: "A", description: "", actions: [] },
				{ id: "s2", title: "B", description: "", actions: [] },
				{ id: "s3", title: "C", description: "", actions: [] },
			],
		});
		const canvas = buildJourneyCanvas(input, deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.activeStepIndex).toBe(1);
	});

	it("returns undefined when no step is active", () => {
		const canvas = buildJourneyCanvas(sampleInput(), deterministicId);
		const result = parseJourneyCanvas(canvas)!;
		expect(result.activeStepIndex).toBeUndefined();
	});
});

describe("parseJourneyCanvas — resilience", () => {
	it("orders steps by edge traversal, not array position", () => {
		// Place groups in reverse order in the nodes array, but edges define correct order
		const canvas: CanvasData = {
			nodes: [
				textNode("start", "▶ Start\nev.start", 0, 0, 160, 80, "4"),
				groupNode("g2", "Second", 520, -40, 480, 160),
				textNode("g2-inner", "0 actions", 570, 10, 380, 60),
				groupNode("g1", "First", 200, -40, 480, 160),
				textNode("g1-inner", "0 actions", 250, 10, 380, 60),
				textNode("end", "⏹ End", 1040, 0, 160, 80, "1"),
			],
			edges: [
				edge("e1", "start", "g1"),
				edge("e2", "g1", "g2"),
				edge("e3", "g2", "end"),
			],
		};
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps[0].title).toBe("First");
		expect(result.steps[1].title).toBe("Second");
	});

	it("ignores decorative nodes not in START→END chain", () => {
		const canvas = minimalCanvas({
			groups: [{ id: "g1", label: "Real Step", innerText: "1 action" }],
			extraNodes: [
				groupNode("decorative", "Not a step", 2000, 2000, 200, 200),
				textNode("note", "Some annotation", 3000, 3000, 300, 100),
			],
		});
		const result = parseJourneyCanvas(canvas)!;
		expect(result.steps).toHaveLength(1);
		expect(result.steps[0].title).toBe("Real Step");
	});
});

describe("round-trip: buildJourneyCanvas → parseJourneyCanvas", () => {
	beforeEach(() => resetIds());

	it("recovers structural data from canvas", () => {
		const input = sampleInput({ activeStepIndex: 0 });
		const canvas = buildJourneyCanvas(input, deterministicId);
		const result = parseJourneyCanvas(canvas)!;

		expect(result).not.toBeNull();
		expect(result.startEvent).toBe(input.startEvent);
		expect(result.endEvent).toBe(input.endEvent);
		expect(result.activeStepIndex).toBe(0);
		expect(result.steps).toHaveLength(input.steps.length);

		for (let i = 0; i < input.steps.length; i++) {
			expect(result.steps[i].title).toBe(input.steps[i].title);
			expect(result.steps[i].description).toBe(input.steps[i].description);
			expect(result.steps[i].actionCount).toBe(input.steps[i].actions.length);
		}
	});
});

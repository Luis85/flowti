/**
 * Canvas sync — generates a companion .canvas file from a journey definition.
 *
 * Pure function: buildJourneyCanvas() → { nodes, edges }
 *
 * Layout: left-to-right flow with START → Step groups → END.
 * Reuses generateCanvasId() from the canvas domain for Obsidian-compatible IDs.
 */
import type { AllCanvasNodeData, CanvasEdgeData } from "obsidian/canvas";
import { generateCanvasId } from "../canvas/CanvasRebuilder";

// ── Types ────────────────────────────────────────────────────

/** Input shape for canvas generation — matches sidebar state. */
export interface CanvasSyncInput {
	journey: string;
	description: string;
	startEvent: string;
	endEvent: string;
	activeStepIndex?: number;
	/** Per-step color overrides (index → Obsidian canvas color). Takes precedence over activeStepIndex. */
	stepColors?: Record<number, string>;
	steps: Array<{
		id: string;
		title: string;
		description: string;
		actions: unknown[];
	}>;
}

// ── Layout constants ─────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 80;
const GROUP_W = 480;
const GROUP_H = 160;
const GAP = 40;
const INNER_PAD = 50;
const INNER_W = GROUP_W - INNER_PAD * 2;
const INNER_H = 60;

// ── Helpers ──────────────────────────────────────────────────

function textNode(
	id: string,
	text: string,
	x: number,
	y: number,
	w: number,
	h: number,
	color?: string,
): AllCanvasNodeData {
	return { id, type: "text", text, x, y, width: w, height: h, ...(color ? { color } : {}) } as AllCanvasNodeData;
}

function groupNode(
	id: string,
	label: string,
	x: number,
	y: number,
	w: number,
	h: number,
	color?: string,
): AllCanvasNodeData {
	return { id, type: "group", label, x, y, width: w, height: h, ...(color ? { color } : {}) } as AllCanvasNodeData;
}

function edgeData(
	id: string,
	from: string,
	to: string,
	label?: string,
): CanvasEdgeData {
	return {
		id,
		fromNode: from,
		toNode: to,
		fromSide: "right",
		toSide: "left",
		fromEnd: "none",
		toEnd: "arrow",
		...(label ? { label } : {}),
	} as CanvasEdgeData;
}

// ── Main function ────────────────────────────────────────────

/**
 * Build an Obsidian canvas from a journey definition.
 *
 * @param input   - Journey metadata + steps
 * @param idGen   - Injectable ID generator (defaults to generateCanvasId)
 * @returns Canvas data with nodes and edges arrays
 */
export function buildJourneyCanvas(
	input: CanvasSyncInput,
	idGen: () => string = generateCanvasId,
): { nodes: AllCanvasNodeData[]; edges: CanvasEdgeData[] } {
	const nodes: AllCanvasNodeData[] = [];
	const edges: CanvasEdgeData[] = [];
	const nodeIds: string[] = []; // ordered: START, steps..., END

	// START node
	const startId = idGen();
	const startText = `▶ Start${input.startEvent ? `\n${input.startEvent}` : ""}`;
	nodes.push(textNode(startId, startText, 0, 0, NODE_W, NODE_H, "4"));
	nodeIds.push(startId);

	// Step groups
	const stepStartX = NODE_W + GAP;
	for (let i = 0; i < input.steps.length; i++) {
		const step = input.steps[i];
		const gx = stepStartX + i * (GROUP_W + GAP);
		const gy = -(GROUP_H - NODE_H) / 2; // vertically center around START

		const groupId = idGen();
		const label = step.title || `Step ${i + 1}`;
		const color = input.stepColors?.[i] ?? (i === input.activeStepIndex ? "5" : undefined);
		nodes.push(groupNode(groupId, label, gx, gy, GROUP_W, GROUP_H, color));

		// Inner text node
		const innerId = idGen();
		const desc = step.description || "";
		const actionCount = step.actions?.length ?? 0;
		const innerText = desc
			? `${desc}\n${actionCount} action${actionCount !== 1 ? "s" : ""}`
			: `${actionCount} action${actionCount !== 1 ? "s" : ""}`;
		nodes.push(textNode(
			innerId,
			innerText,
			gx + INNER_PAD,
			gy + (GROUP_H - INNER_H) / 2,
			INNER_W,
			INNER_H,
		));

		nodeIds.push(groupId);
	}

	// END node
	const endId = idGen();
	const endX = input.steps.length > 0
		? stepStartX + input.steps.length * (GROUP_W + GAP)
		: NODE_W + GAP;
	const endText = `⏹ End${input.endEvent ? `\n${input.endEvent}` : ""}`;
	nodes.push(textNode(endId, endText, endX, 0, NODE_W, NODE_H, "1"));
	nodeIds.push(endId);

	// Edges: START → Step1 → Step2 → ... → END
	for (let i = 0; i < nodeIds.length - 1; i++) {
		edges.push(edgeData(idGen(), nodeIds[i], nodeIds[i + 1]));
	}

	return { nodes, edges };
}

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
		backgroundImage?: string;
	}>;
}

// ── Layout constants ─────────────────────────────────────────

import { CANVAS_GAP, JOURNEY_LAYOUT } from "../canvas/layoutConstants";

const { NODE_W, NODE_H, GROUP_W, GROUP_H, INNER_PAD, INNER_W, INNER_H } = JOURNEY_LAYOUT;
const GAP = CANVAS_GAP;

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
	background?: string,
): AllCanvasNodeData {
	return {
		id, type: "group", label, x, y, width: w, height: h,
		...(color ? { color } : {}),
		...(background ? { background, backgroundStyle: "cover" } : {}),
	} as AllCanvasNodeData;
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
/** Build a step group with inner text node. */
function buildStepGroup(
	step: CanvasSyncInput["steps"][number],
	index: number,
	input: CanvasSyncInput,
	idGen: () => string,
	nodes: AllCanvasNodeData[],
): string {
	const stepStartX = NODE_W + GAP;
	const gx = stepStartX + index * (GROUP_W + GAP);
	const gy = -(GROUP_H - NODE_H) / 2;

	const gid = idGen();
	const label = step.title || `Step ${index + 1}`;
	const color = input.stepColors?.[index] ?? (index === input.activeStepIndex ? "5" : undefined);
	nodes.push(groupNode(gid, label, gx, gy, GROUP_W, GROUP_H, color, step.backgroundImage));

	const innerId = idGen();
	const actionCount = step.actions?.length ?? 0;
	const actionLabel = `${actionCount} action${actionCount !== 1 ? "s" : ""}`;
	const innerText = step.description ? `${step.description}\n${actionLabel}` : actionLabel;
	nodes.push(textNode(innerId, innerText, gx + INNER_PAD, gy + (GROUP_H - INNER_H) / 2, INNER_W, INNER_H));

	return gid;
}

export function buildJourneyCanvas(
	input: CanvasSyncInput,
	idGen: () => string = generateCanvasId,
): { nodes: AllCanvasNodeData[]; edges: CanvasEdgeData[] } {
	const nodes: AllCanvasNodeData[] = [];
	const edges: CanvasEdgeData[] = [];
	const nodeIds: string[] = [];

	// START node
	const startId = idGen();
	nodes.push(textNode(startId, `▶ Start${input.startEvent ? `\n${input.startEvent}` : ""}`, 0, 0, NODE_W, NODE_H, "4"));
	nodeIds.push(startId);

	// Step groups
	for (let i = 0; i < input.steps.length; i++) {
		nodeIds.push(buildStepGroup(input.steps[i], i, input, idGen, nodes));
	}

	// END node
	const endId = idGen();
	const endX = input.steps.length > 0 ? NODE_W + GAP + input.steps.length * (GROUP_W + GAP) : NODE_W + GAP;
	nodes.push(textNode(endId, `⏹ End${input.endEvent ? `\n${input.endEvent}` : ""}`, endX, 0, NODE_W, NODE_H, "1"));
	nodeIds.push(endId);

	for (let i = 0; i < nodeIds.length - 1; i++) {
		edges.push(edgeData(idGen(), nodeIds[i], nodeIds[i + 1]));
	}

	return { nodes, edges };
}

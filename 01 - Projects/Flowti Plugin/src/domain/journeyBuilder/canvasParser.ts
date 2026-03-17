/**
 * Canvas parser — extracts a journey definition from a companion .canvas file.
 *
 * Pure function: parseJourneyCanvas() → ParsedJourneyCanvas | null
 *
 * Inverse of buildJourneyCanvas() in canvasSync.ts.
 * Detects START/END text nodes, follows edges to determine step ordering,
 * and extracts step metadata from group labels and inner text nodes.
 */
import type { AllCanvasNodeData, CanvasData } from "obsidian/canvas";

// ── Types ────────────────────────────────────────────────────

/** A step parsed from a journey canvas. */
export interface ParsedCanvasStep {
	/** Group node label (step title). */
	title: string;
	/** Inner text node description (lines before the action count). */
	description: string;
	/** Number parsed from the "N action(s)" line. */
	actionCount: number;
	/** The canvas group node's ID — enables bidirectional sync matching. */
	canvasGroupId: string;
	/** Vault-relative path to the group's background image (if set). */
	backgroundImage?: string;
}

/** The structural data recovered from a journey canvas. */
export interface ParsedJourneyCanvas {
	startEvent: string;
	endEvent: string;
	activeStepIndex: number | undefined;
	steps: ParsedCanvasStep[];
}

// ── Detection ────────────────────────────────────────────────

/**
 * Returns true if the canvas has both a START node (text, color "4", "▶")
 * and an END node (text, color "1", "⏹").
 */
export function isJourneyCanvas(canvas: CanvasData): boolean {
	return !!findStartNode(canvas.nodes) && !!findEndNode(canvas.nodes);
}

// ── Parser ───────────────────────────────────────────────────

/**
 * Parses a journey-structured canvas into structured journey data.
 * Returns null when the canvas is not a valid journey canvas.
 */
export function parseJourneyCanvas(canvas: CanvasData): ParsedJourneyCanvas | null {
	const startNode = findStartNode(canvas.nodes);
	const endNode = findEndNode(canvas.nodes);
	if (!startNode || !endNode) return null;

	const startEvent = parseEventFromText(startNode.text);
	const endEvent = parseEventFromText(endNode.text);

	// Build forward adjacency: fromNode → toNode
	const forward = new Map<string, string>();
	for (const edge of canvas.edges) {
		forward.set(edge.fromNode, edge.toNode);
	}

	// Walk chain: START → ... → END, collecting group IDs
	const orderedGroups: AllCanvasNodeData[] = [];
	const nodeMap = new Map(canvas.nodes.map((n) => [n.id, n]));
	const visited = new Set<string>();
	let currentId = forward.get(startNode.id);

	while (currentId && currentId !== endNode.id && !visited.has(currentId)) {
		visited.add(currentId);
		const node = nodeMap.get(currentId);
		if (node && node.type === "group") {
			orderedGroups.push(node);
		}
		currentId = forward.get(currentId);
	}

	// Extract steps from groups
	const steps: ParsedCanvasStep[] = orderedGroups.map((group) => {
		const inner = findContainedTextNode(canvas.nodes, group);
		const { description, actionCount } = parseInnerText(
			inner && inner.type === "text" ? (inner as { text: string }).text : "",
		);
		const bg = (group as { background?: string }).background;
		return {
			title: group.type === "group" ? ((group as { label?: string }).label ?? "") : "",
			description,
			actionCount,
			canvasGroupId: group.id,
			...(bg ? { backgroundImage: bg } : {}),
		};
	});

	// Detect active step (color "5")
	let activeStepIndex: number | undefined;
	for (let i = 0; i < orderedGroups.length; i++) {
		if ((orderedGroups[i] as { color?: string }).color === "5") {
			activeStepIndex = i;
			break;
		}
	}

	return { startEvent, endEvent, activeStepIndex, steps };
}

// ── Helpers (private) ────────────────────────────────────────

function findStartNode(nodes: AllCanvasNodeData[]): (AllCanvasNodeData & { text: string }) | undefined {
	return nodes.find(
		(n): n is AllCanvasNodeData & { text: string } =>
			n.type === "text" && (n as { color?: string }).color === "4" && (n as { text: string }).text.startsWith("▶"),
	);
}

function findEndNode(nodes: AllCanvasNodeData[]): (AllCanvasNodeData & { text: string }) | undefined {
	return nodes.find(
		(n): n is AllCanvasNodeData & { text: string } =>
			n.type === "text" && (n as { color?: string }).color === "1" && (n as { text: string }).text.startsWith("⏹"),
	);
}

/** Extract event name from the second line of a START/END node text. */
function parseEventFromText(text: string): string {
	const lines = text.split("\n");
	return lines.length >= 2 ? lines[1].trim() : "";
}

/** Find a text node spatially contained within a group node's bounding box. */
function findContainedTextNode(
	nodes: AllCanvasNodeData[],
	group: AllCanvasNodeData,
): AllCanvasNodeData | null {
	for (const node of nodes) {
		if (node.type !== "text" || node.id === group.id) continue;
		if (
			node.x >= group.x &&
			node.y >= group.y &&
			node.x + node.width <= group.x + group.width &&
			node.y + node.height <= group.y + group.height
		) {
			return node;
		}
	}
	return null;
}

/** Split inner text into description and action count. */
function parseInnerText(text: string): { description: string; actionCount: number } {
	if (!text) return { description: "", actionCount: 0 };
	const lines = text.split("\n");
	const lastLine = lines[lines.length - 1].trim();
	const match = lastLine.match(/^(\d+) actions?$/);
	if (match) {
		return {
			description: lines.slice(0, -1).join("\n").trim(),
			actionCount: parseInt(match[1], 10),
		};
	}
	return { description: text.trim(), actionCount: 0 };
}

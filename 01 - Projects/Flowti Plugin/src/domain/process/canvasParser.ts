/**
 * Canvas process parser — extracts a ProcessDefinition from Canvas JSON.
 *
 * Pure function: parseProcessCanvas() → ProcessDefinition | null
 *
 * Detects process nodes by title token prefix (●, ■, ◇, ⦿),
 * parses fenced YAML metadata from node bodies, and builds a typed graph.
 */

import type { ProcessDefinition, ProcessNode, ProcessEdge, ProcessNodeType, ProcessNodeMetadata } from "./types";
import { TOKEN_TO_NODE_TYPE } from "./types";

// ── Canvas JSON shape (subset of Obsidian canvas format) ────

/** Minimal canvas node shape for parsing (avoids Obsidian import). */
export interface CanvasNodeData {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	label?: string;
	color?: string;
}

/** Minimal canvas edge shape. */
export interface CanvasEdgeData {
	fromNode: string;
	toNode: string;
	fromSide?: string;
	toSide?: string;
	label?: string;
}

/** Canvas JSON root shape. */
export interface CanvasJson {
	nodes: CanvasNodeData[];
	edges: CanvasEdgeData[];
}

// ── Detection ───────────────────────────────────────────────

/** Token characters used to identify process nodes. */
const TOKEN_CHARS = Object.keys(TOKEN_TO_NODE_TYPE);

/**
 * Returns true if the canvas contains at least one process node
 * (detected by title token prefix).
 */
export function isProcessCanvas(canvas: CanvasJson): boolean {
	return canvas.nodes.some((n) => detectNodeType(n) !== null);
}

// ── Parser ──────────────────────────────────────────────────

/**
 * Parses a process canvas into a ProcessDefinition.
 * Returns null if no process nodes are found.
 *
 * @param canvas - Parsed Canvas JSON
 * @param name - Process name (typically from file name)
 * @param filePath - Vault-relative path to the canvas file
 */
export function parseProcessCanvas(
	canvas: CanvasJson,
	name: string,
	filePath: string,
): ProcessDefinition | null {
	const nodes: ProcessNode[] = [];
	const nodeIdSet = new Set<string>();

	for (const canvasNode of canvas.nodes) {
		const nodeType = detectNodeType(canvasNode);
		if (nodeType === null) continue;

		const nodeName = extractNodeName(canvasNode, nodeType);
		const metadata = extractMetadata(canvasNode);

		nodes.push({
			id: canvasNode.id,
			type: nodeType,
			name: nodeName,
			metadata,
			x: canvasNode.x,
			y: canvasNode.y,
		});
		nodeIdSet.add(canvasNode.id);
	}

	if (nodes.length === 0) return null;

	// Only include edges that connect process nodes
	const edges: ProcessEdge[] = [];
	for (const canvasEdge of canvas.edges) {
		if (!nodeIdSet.has(canvasEdge.fromNode) || !nodeIdSet.has(canvasEdge.toNode)) continue;
		edges.push({
			fromNode: canvasEdge.fromNode,
			toNode: canvasEdge.toNode,
			...(canvasEdge.label ? { label: canvasEdge.label } : {}),
		});
	}

	return { name, filePath, nodes, edges };
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Detects the process node type from a canvas node's text content.
 * Looks for token prefix (●, ■, ◇, ⦿) in the first line of text or label.
 */
export function detectNodeType(node: CanvasNodeData): ProcessNodeType | null {
	const text = (node.text ?? node.label ?? "").trim();
	if (!text) return null;

	const firstLine = text.split("\n")[0].trim();
	for (const token of TOKEN_CHARS) {
		if (firstLine.startsWith(token)) {
			return TOKEN_TO_NODE_TYPE[token];
		}
	}
	return null;
}

/**
 * Extracts the display name from a process node.
 * Removes the token prefix and trims whitespace.
 */
export function extractNodeName(node: CanvasNodeData, nodeType: ProcessNodeType): string {
	const text = (node.text ?? node.label ?? "").trim();
	const firstLine = text.split("\n")[0].trim();

	// Find and remove the token prefix
	for (const token of TOKEN_CHARS) {
		if (firstLine.startsWith(token)) {
			return firstLine.substring(token.length).trim();
		}
	}
	return firstLine;
}

/**
 * Extracts metadata from fenced YAML in a node body.
 * Looks for ```yaml ... ``` blocks after the first line.
 */
export function extractMetadata(node: CanvasNodeData): ProcessNodeMetadata {
	const text = (node.text ?? "").trim();
	if (!text) return {};

	const yamlMatch = text.match(/```ya?ml\s*\n([\s\S]*?)```/);
	if (!yamlMatch) return {};

	return parseSimpleYaml(yamlMatch[1]);
}

/**
 * Parses simple YAML key-value pairs (no nesting, no arrays).
 * Handles: `key: value`, `key: "quoted"`, `key: 42`.
 */
export function parseSimpleYaml(yaml: string): ProcessNodeMetadata {
	const result: ProcessNodeMetadata = {};
	const lines = yaml.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const colonIdx = trimmed.indexOf(":");
		if (colonIdx <= 0) continue;

		const key = trimmed.substring(0, colonIdx).trim();
		let value: string | number = trimmed.substring(colonIdx + 1).trim();

		// Remove surrounding quotes
		if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		// Parse numbers
		const num = Number(value);
		if (value !== "" && !isNaN(num)) {
			result[key] = num;
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Canvas types for Obsidian canvas file generation.
 *
 * Based on the Obsidian Canvas JSON format:
 * https://jsoncanvas.org/
 */

/**
 * Color palette for canvas nodes.
 * Maps to Obsidian's canvas color scheme (1-6).
 */
export const CANVAS_COLORS = {
	red: "1",      // Problems/Gaps
	orange: "2",   // JTBD
	yellow: "3",   // Ideas
	green: "4",    // Requirements (Satisfied)
	blue: "5",     // Requirements (Proposed)
	purple: "6",   // Solutions
} as const;

export type CanvasColor = (typeof CANVAS_COLORS)[keyof typeof CANVAS_COLORS];

/**
 * Side of a node for edge connections.
 */
export type NodeSide = "top" | "right" | "bottom" | "left";

/**
 * Canvas node types.
 */
export type CanvasNodeType = "text" | "file" | "link" | "group";

/**
 * Base canvas node properties.
 */
interface CanvasNodeBase {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: CanvasColor;
}

/**
 * Text node for displaying text content.
 */
export interface CanvasTextNode extends CanvasNodeBase {
	type: "text";
	text: string;
}

/**
 * File node for linking to files.
 */
export interface CanvasFileNode extends CanvasNodeBase {
	type: "file";
	file: string;
}

/**
 * Link node for external URLs.
 */
export interface CanvasLinkNode extends CanvasNodeBase {
	type: "link";
	url: string;
}

/**
 * Group node for grouping other nodes.
 */
export interface CanvasGroupNode extends CanvasNodeBase {
	type: "group";
	label?: string;
}

/**
 * Union type for all canvas nodes.
 */
export type CanvasNode =
	| CanvasTextNode
	| CanvasFileNode
	| CanvasLinkNode
	| CanvasGroupNode;

/**
 * Canvas edge connecting two nodes.
 */
export interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide?: NodeSide;
	toSide?: NodeSide;
	fromEnd?: "none" | "arrow";
	toEnd?: "none" | "arrow";
	color?: CanvasColor;
	label?: string;
}

/**
 * Complete canvas data structure.
 */
export interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

/**
 * Layout configuration for canvas generation.
 */
export interface CanvasLayoutConfig {
	/** Starting X position */
	startX: number;
	/** Starting Y position */
	startY: number;
	/** Horizontal spacing between nodes */
	horizontalGap: number;
	/** Vertical spacing between rows */
	verticalGap: number;
	/** Default node width */
	nodeWidth: number;
	/** Default node height */
	nodeHeight: number;
	/** Group padding */
	groupPadding: number;
}

/**
 * Default layout configuration.
 */
export const DEFAULT_LAYOUT_CONFIG: CanvasLayoutConfig = {
	startX: 0,
	startY: 0,
	horizontalGap: 50,
	verticalGap: 100,
	nodeWidth: 300,
	nodeHeight: 150,
	groupPadding: 40,
};

/**
 * Generate a random hex ID for canvas elements.
 * Uses 16 characters to match Obsidian's format.
 */
export function generateCanvasId(): string {
	const chars = "0123456789abcdef";
	let result = "";
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Create a text node.
 */
export function createTextNode(
	text: string,
	x: number,
	y: number,
	options: Partial<Omit<CanvasTextNode, "type" | "text" | "x" | "y">> = {}
): CanvasTextNode {
	return {
		id: generateCanvasId(),
		type: "text",
		text,
		x,
		y,
		width: options.width ?? DEFAULT_LAYOUT_CONFIG.nodeWidth,
		height: options.height ?? DEFAULT_LAYOUT_CONFIG.nodeHeight,
		color: options.color,
	};
}

/**
 * Create a file node.
 */
export function createFileNode(
	filePath: string,
	x: number,
	y: number,
	options: Partial<Omit<CanvasFileNode, "type" | "file" | "x" | "y">> = {}
): CanvasFileNode {
	return {
		id: generateCanvasId(),
		type: "file",
		file: filePath,
		x,
		y,
		width: options.width ?? DEFAULT_LAYOUT_CONFIG.nodeWidth,
		height: options.height ?? DEFAULT_LAYOUT_CONFIG.nodeHeight,
		color: options.color,
	};
}

/**
 * Create a group node.
 */
export function createGroupNode(
	label: string,
	x: number,
	y: number,
	width: number,
	height: number,
	options: Partial<Omit<CanvasGroupNode, "type" | "x" | "y" | "width" | "height">> = {}
): CanvasGroupNode {
	return {
		id: generateCanvasId(),
		type: "group",
		label,
		x,
		y,
		width,
		height,
		color: options.color,
	};
}

/**
 * Create an edge between two nodes.
 */
export function createEdge(
	fromNode: string,
	toNode: string,
	options: Partial<Omit<CanvasEdge, "id" | "fromNode" | "toNode">> = {}
): CanvasEdge {
	return {
		id: generateCanvasId(),
		fromNode,
		toNode,
		fromSide: options.fromSide ?? "bottom",
		toSide: options.toSide ?? "top",
		fromEnd: options.fromEnd ?? "none",
		toEnd: options.toEnd ?? "arrow",
		color: options.color,
		label: options.label,
	};
}

/**
 * Serialize canvas data to JSON string.
 */
export function serializeCanvas(data: CanvasData): string {
	return JSON.stringify(data, null, "\t");
}

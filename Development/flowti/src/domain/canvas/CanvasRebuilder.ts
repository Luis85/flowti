/**
 * Canvas rebuilder — creates a copy of the canvas where imported text nodes
 * become file-node references pointing to the created vault notes.
 *
 * Ported from QuickAdd canvas-import-canvas.js.
 *
 * Pure functions:
 *   generateCanvasId()    — create a 16-char hex ID
 *   rebuildCanvasData()   — replace text nodes with file references
 *
 * I/O function:
 *   writeRebuiltCanvas()  — write rebuilt canvas to vault
 */

import type { AllCanvasNodeData, CanvasEdgeData } from "obsidian/canvas";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import { slugifyTitle } from "./CanvasParser";

// ── Types ────────────────────────────────────────────────────

/** Result of rebuilding canvas data. */
export interface RebuiltCanvasData {
	nodes: AllCanvasNodeData[];
	edges: CanvasEdgeData[];
}

/** Result of writing a rebuilt canvas file. */
export interface WriteRebuiltCanvasResult {
	action: "created" | "updated" | "skipped";
	path: string;
}

// ── Pure functions ───────────────────────────────────────────

/**
 * Generate a 16-character hexadecimal ID for canvas nodes/edges.
 * Matches Obsidian's canvas ID format.
 */
export function generateCanvasId(): string {
	const chars = "0123456789abcdef";
	let id = "";
	for (let i = 0; i < 16; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

/**
 * Rebuild canvas data: replace imported text nodes with file-node references.
 *
 * For each original node:
 *   - Groups and existing file nodes → preserved with new ID
 *   - Text/link nodes with imported note → become file-node references
 *   - Text/link nodes without imported note → preserved with new ID
 *
 * Edges are remapped to use the new node IDs. Edges referencing
 * nodes not in the original set are silently dropped.
 *
 * Spatial layout (x, y, width, height) is always preserved.
 *
 * @param idGenerator - injectable for deterministic testing (defaults to generateCanvasId)
 */
export function rebuildCanvasData(
	originalNodes: AllCanvasNodeData[],
	originalEdges: CanvasEdgeData[],
	filePathById: Map<string, string>,
	idGenerator: () => string = generateCanvasId,
): RebuiltCanvasData {
	const nodes: AllCanvasNodeData[] = [];
	const idMapping = new Map<string, string>();

	for (const original of originalNodes) {
		const newId = idGenerator();
		idMapping.set(original.id, newId);

		// Groups and file nodes: preserve all original data
		if (original.type === "group" || original.type === "file") {
			nodes.push({ ...original, id: newId });
			continue;
		}

		// Text/link nodes with imported note path → become file references
		const filePath = filePathById.get(original.id);
		if (filePath) {
			nodes.push({
				id: newId,
				type: "file",
				file: filePath,
				x: original.x,
				y: original.y,
				width: original.width,
				height: original.height,
				...(original.color != null ? { color: original.color } : {}),
			} as AllCanvasNodeData);
			continue;
		}

		// Fallback: copy node with new ID
		nodes.push({ ...original, id: newId });
	}

	const edges: CanvasEdgeData[] = [];

	for (const edge of originalEdges) {
		const newFromId = idMapping.get(edge.fromNode);
		const newToId = idMapping.get(edge.toNode);
		if (!newFromId || !newToId) continue;

		edges.push({
			id: idGenerator(),
			fromNode: newFromId,
			fromSide: edge.fromSide,
			toNode: newToId,
			toSide: edge.toSide,
			...(edge.fromEnd ? { fromEnd: edge.fromEnd } : {}),
			...(edge.toEnd ? { toEnd: edge.toEnd } : {}),
			...(edge.color != null ? { color: edge.color } : {}),
			...(edge.label ? { label: edge.label } : {}),
		} as CanvasEdgeData);
	}

	return { nodes, edges };
}

// ── I/O function ─────────────────────────────────────────────

/**
 * Write a rebuilt canvas file to the vault.
 *
 * Path: `targetFolder/slugifiedName.canvas`
 * Creates folders if needed. Skips existing unless overwrite is true.
 */
export async function writeRebuiltCanvas(
	canvasData: RebuiltCanvasData,
	targetFolder: string,
	canvasName: string,
	fileSystem: IFileSystemClient,
	overwrite = false,
): Promise<WriteRebuiltCanvasResult> {
	const name = slugifyTitle(canvasName || "canvas");
	const path = `${targetFolder}/${name}.canvas`;
	const content = JSON.stringify(canvasData, null, 2);

	const exists = await fileSystem.fileExists(path);
	if (exists) {
		if (overwrite) {
			await fileSystem.updateFile(path, content);
			return { action: "updated", path };
		}
		return { action: "skipped", path };
	}

	await fileSystem.createFile(path, content, { createFolders: true });
	return { action: "created", path };
}

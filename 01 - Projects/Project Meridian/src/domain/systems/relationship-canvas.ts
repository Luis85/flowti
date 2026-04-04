import type { RelationshipEntry } from '../core/component-data.js';

export interface RelationshipGraphInput {
	agents: { id: string; name: string; kind: string; color: string }[];
	relationships: { agentId: string; entries: RelationshipEntry[] }[];
}

interface CanvasNode {
	id: string;
	type: 'text';
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	label: string;
	color: string;
}

interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const CENTER_X = 400;
const CENTER_Y = 300;
const RADIUS = 200;

function agentColorToCanvasColor(hexColor: string): string {
	const hex = hexColor.replace(/^#/, '');
	if (hex.length < 6) return '0';

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	if (isNaN(r) || isNaN(g) || isNaN(b)) return '0';

	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const delta = max - min;

	// Low saturation → grey → "0"
	const saturation = max === 0 ? 0 : delta / max;
	if (saturation < 0.15) return '0';

	let hue = 0;
	if (delta !== 0) {
		if (max === rn) {
			hue = 60 * (((gn - bn) / delta) % 6);
		} else if (max === gn) {
			hue = 60 * ((bn - rn) / delta + 2);
		} else {
			hue = 60 * ((rn - gn) / delta + 4);
		}
	}
	if (hue < 0) hue += 360;

	// Map hue ranges to Obsidian Canvas color indices
	if (hue >= 330 || hue < 30) return '1';  // red
	if (hue < 60) return '2';                 // orange
	if (hue < 90) return '3';                 // yellow
	if (hue < 180) return '4';                // green
	if (hue < 270) return '5';                // cyan/blue
	return '6';                                // purple
}

function edgeColor(disposition: number): string {
	if (disposition >= 20) return '4';
	if (disposition <= -20) return '1';
	return '0';
}

import { pairKey as sortedPairKey } from '../core/math-utils.js';

function buildNodes(
	agents: RelationshipGraphInput['agents'],
	cx: number,
	cy: number,
	radius: number,
	layout: 'circle' | 'semicircle',
	startIndex = 0,
): CanvasNode[] {
	const n = agents.length;
	return agents.map((agent, i) => {
		const idx = i + startIndex;
		let x: number;
		let y: number;

		if (layout === 'circle') {
			const angle = (2 * Math.PI * idx) / Math.max(n + startIndex, 1);
			x = cx + radius * Math.cos(angle) - NODE_WIDTH / 2;
			y = cy + radius * Math.sin(angle) - NODE_HEIGHT / 2;
		} else {
			const divisor = Math.max(n + startIndex - 1, 1);
			const angle = (Math.PI * idx) / divisor;
			x = cx + radius * Math.cos(angle) - NODE_WIDTH / 2;
			y = cy + radius * Math.sin(angle) - NODE_HEIGHT / 2;
		}

		return {
			id: agent.id,
			type: 'text' as const,
			text: `${agent.name}\n${agent.kind}`,
			x: Math.round(x * 100) / 100,
			y: Math.round(y * 100) / 100,
			width: NODE_WIDTH,
			height: NODE_HEIGHT,
			color: agentColorToCanvasColor(agent.color),
		};
	});
}

function buildEdges(
	relationships: RelationshipGraphInput['relationships'],
	filterAgentId?: string,
): CanvasEdge[] {
	const edges: CanvasEdge[] = [];
	const seen = new Set<string>();

	for (const rel of relationships) {
		if (filterAgentId !== undefined && rel.agentId !== filterAgentId) continue;

		for (const entry of rel.entries) {
			if (entry.familiarity <= 0) continue;

			const key = sortedPairKey(rel.agentId, entry.agentId);
			if (seen.has(key)) continue;
			seen.add(key);

			edges.push({
				id: `rel-${rel.agentId}-${entry.agentId}`,
				fromNode: rel.agentId,
				toNode: entry.agentId,
				label: `disposition: ${entry.disposition} | familiarity: ${entry.familiarity}`,
				color: edgeColor(entry.disposition),
			});
		}
	}

	return edges;
}

export function serializeRelationshipGraph(input: RelationshipGraphInput): string {
	const nodes = buildNodes(input.agents, CENTER_X, CENTER_Y, RADIUS, 'circle');
	const edges = buildEdges(input.relationships);

	const canvas: CanvasData = { nodes, edges };
	return JSON.stringify(canvas, null, '\t');
}

export function serializeAgentRelationshipView(agentId: string, input: RelationshipGraphInput): string {
	const targetAgent = input.agents.find(a => a.id === agentId);
	if (targetAgent === undefined) {
		const canvas: CanvasData = { nodes: [], edges: [] };
		return JSON.stringify(canvas, null, '\t');
	}

	// Target agent at center
	const centerNode: CanvasNode = {
		id: targetAgent.id,
		type: 'text',
		text: `${targetAgent.name}\n${targetAgent.kind}`,
		x: CENTER_X - NODE_WIDTH / 2,
		y: CENTER_Y - NODE_HEIGHT / 2,
		width: NODE_WIDTH,
		height: NODE_HEIGHT,
		color: agentColorToCanvasColor(targetAgent.color),
	};

	// Find connected agents (those with familiarity > 0)
	const agentRels = input.relationships.find(r => r.agentId === agentId);
	const connectedIds = new Set(
		(agentRels?.entries ?? [])
			.filter(e => e.familiarity > 0)
			.map(e => e.agentId),
	);

	const connectedAgents = input.agents.filter(a => connectedIds.has(a.id));
	const peripheralNodes = buildNodes(connectedAgents, CENTER_X, CENTER_Y, RADIUS, 'semicircle');

	const nodes = [centerNode, ...peripheralNodes];
	const edges = buildEdges(input.relationships, agentId);

	const canvas: CanvasData = { nodes, edges };
	return JSON.stringify(canvas, null, '\t');
}

/**
 * Generates a world snapshot canvas from shipped agent + location data.
 * Run: node scripts/generate-world-snapshot.mjs
 * Called automatically by the vite build plugin.
 *
 * Output: dist/03 - Resources/Graphs/world-snapshot.canvas
 * An Obsidian canvas showing all agents and locations with their positions,
 * types, colors, and starting relationships.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function loadJsonDir(dir) {
	const fullPath = resolve(projectRoot, dir);
	try {
		return readdirSync(fullPath)
			.filter(f => f.endsWith('.json'))
			.map(f => JSON.parse(readFileSync(resolve(fullPath, f), 'utf-8')));
	} catch { return []; }
}

// --- Load data ---
const agents = loadJsonDir('agents');
const locations = loadJsonDir('locations');

// --- Obsidian canvas color map (index-based: 1=red, 2=orange, 3=yellow, 4=green, 5=cyan, 6=purple) ---
const OBSIDIAN_COLORS = {
	'#e94560': '1',  // red — guard
	'#e6a820': '3',  // yellow — merchant
	'#4da6ff': '6',  // purple — scholar
	'#50c878': '4',  // green — artisan
};

const LOCATION_TYPE_COLORS = {
	rest: '6',     // purple
	food: '3',     // yellow
	social: '5',   // cyan
	work: '2',     // orange
	market: '3',   // yellow
};

// --- Build canvas ---
const nodes = [];
const edges = [];

// Scale factor: game positions → canvas positions (canvas uses larger coordinates)
const SCALE = 3;
const OFFSET_X = 100;
const OFFSET_Y = 100;

// Add location nodes (squares — represented by wider nodes)
for (const loc of locations) {
	nodes.push({
		id: loc.id,
		type: 'text',
		text: `📍 ${loc.name}\n(${loc.type}, cap ${loc.capacity})`,
		x: loc.position.x * SCALE + OFFSET_X,
		y: loc.position.y * SCALE + OFFSET_Y,
		width: 200,
		height: 60,
		color: LOCATION_TYPE_COLORS[loc.type] ?? '0',
	});
}

// Add agent nodes (positioned at their starting locations)
for (const agent of agents) {
	const traits = (agent.traits || []).join(', ') || 'none';
	const needs = agent.needs;
	nodes.push({
		id: agent.id,
		type: 'text',
		text: `🧑 ${agent.name} (${agent.kind})\nHP:${needs.hunger} EN:${needs.energy} SO:${needs.social}\nTraits: ${traits}`,
		x: agent.position.x * SCALE + OFFSET_X,
		y: agent.position.y * SCALE + OFFSET_Y + 80,
		width: 220,
		height: 80,
		color: OBSIDIAN_COLORS[agent.color] ?? '0',
	});
}

// Add relationship edges by reading per-agent canvas files
for (const agent of agents) {
	const canvasFile = agent.relationships;
	if (!canvasFile) continue;
	const filename = canvasFile.split('/').pop();
	const canvasPath = resolve(projectRoot, 'graphs', filename);
	try {
		const canvas = JSON.parse(readFileSync(canvasPath, 'utf-8'));
		for (const edge of (canvas.edges || [])) {
			// Only add edges FROM this agent to avoid duplicates
			if (edge.fromNode === agent.id.replace('agent-', '')) {
				const fromId = `agent-${edge.fromNode}`;
				const toId = `agent-${edge.toNode}`;
				// Check both agents exist
				if (agents.some(a => a.id === fromId) && agents.some(a => a.id === toId)) {
					edges.push({
						id: `world-${fromId}-${toId}`,
						fromNode: fromId,
						toNode: toId,
						label: edge.label || '',
					});
				}
			}
		}
	} catch { /* graph file missing or malformed — skip */ }
}

const canvas = { nodes, edges };

// --- Write output ---
const outDir = resolve(projectRoot, 'dist', '03 - Resources', 'Graphs');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'world-snapshot.canvas');
writeFileSync(outPath, JSON.stringify(canvas, null, '\t'));
console.log(`World snapshot generated: ${outPath} (${nodes.length} nodes, ${edges.length} edges)`);

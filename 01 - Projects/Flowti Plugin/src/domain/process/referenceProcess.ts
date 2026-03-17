/**
 * Development Lifecycle reference process — the canonical 10-phase
 * process definition used as the default lifecycle map.
 *
 * Generates both a ProcessDefinition (for validation/runtime) and
 * raw canvas JSON (for writing a .process.canvas file to the vault).
 */

import type { ProcessDefinition, ProcessNode, ProcessEdge } from "./types";
import { LIFECYCLE_PHASES, NODE_TYPE_TOKENS } from "./types";
import type { ProcessNodeType } from "./types";

// ── Layout constants ────────────────────────────────────────

const NODE_W = 260;
const NODE_H = 100;
const GAP_Y = 60;
const STEP_Y = NODE_H + GAP_Y;

// ── Node definitions ────────────────────────────────────────

interface NodeSpec {
	id: string;
	type: ProcessNodeType;
	phase: number;
	role: string;
}

const NODE_SPECS: readonly NodeSpec[] = [
	{ id: "p01", type: "start",    phase: 1,  role: "product-owner" },
	{ id: "p02", type: "activity", phase: 2,  role: "product-owner" },
	{ id: "p03", type: "activity", phase: 3,  role: "architect" },
	{ id: "p04", type: "decision", phase: 4,  role: "team" },
	{ id: "p05", type: "activity", phase: 5,  role: "product-owner" },
	{ id: "p06", type: "activity", phase: 6,  role: "engineer" },
	{ id: "p07", type: "activity", phase: 7,  role: "engineer" },
	{ id: "p08", type: "decision", phase: 8,  role: "team" },
	{ id: "p09", type: "activity", phase: 9,  role: "engineer" },
	{ id: "p10", type: "end",      phase: 10, role: "product-owner" },
] as const;

// ── Edge definitions ────────────────────────────────────────

interface EdgeSpec {
	from: string;
	to: string;
	label?: string;
	/** True for rework/loop-back edges (rendered right-to-right). */
	rework?: boolean;
}

const EDGE_SPECS: readonly EdgeSpec[] = [
	{ from: "p01", to: "p02" },
	{ from: "p02", to: "p03" },
	{ from: "p03", to: "p04" },
	{ from: "p04", to: "p05", label: "Approved" },
	{ from: "p04", to: "p02", label: "Rework", rework: true },
	{ from: "p05", to: "p06" },
	{ from: "p06", to: "p07" },
	{ from: "p07", to: "p08" },
	{ from: "p08", to: "p09", label: "Accepted" },
	{ from: "p08", to: "p06", label: "Rework", rework: true },
	{ from: "p09", to: "p10" },
] as const;

// ── Generators ──────────────────────────────────────────────

function buildNodeText(spec: NodeSpec): string {
	const lp = LIFECYCLE_PHASES.find(p => p.phase === spec.phase)!;
	const token = NODE_TYPE_TOKENS[spec.type];
	const lines = [`${token} ${lp.name}`];
	lines.push("```yaml");
	lines.push(`phase: ${spec.phase}`);
	lines.push(`role: ${spec.role}`);
	lines.push(`description: ${lp.description}`);
	lines.push("```");
	return lines.join("\n");
}

/** Generate the Development Lifecycle as a ProcessDefinition. */
export function generateDevelopmentLifecycle(): ProcessDefinition {
	const nodes: ProcessNode[] = NODE_SPECS.map((spec, i) => {
		const lp = LIFECYCLE_PHASES.find(p => p.phase === spec.phase)!;
		return {
			id: spec.id,
			type: spec.type,
			name: lp.name,
			metadata: {
				phase: spec.phase,
				role: spec.role,
				description: lp.description,
			},
			x: 0,
			y: i * STEP_Y,
		};
	});

	const edges: ProcessEdge[] = EDGE_SPECS.map(e => ({
		fromNode: e.from,
		toNode: e.to,
		label: e.label,
	}));

	return {
		name: "Development Lifecycle",
		filePath: "docs/processes/development-lifecycle.process.canvas",
		nodes,
		edges,
	};
}

/** Generate raw canvas JSON for writing to a .process.canvas file. */
export function generateDevelopmentLifecycleCanvas(): string {
	const nodes = NODE_SPECS.map((spec, i) => ({
		id: spec.id,
		type: "text" as const,
		text: buildNodeText(spec),
		x: 0,
		y: i * STEP_Y,
		width: NODE_W,
		height: NODE_H,
	}));

	const edges = EDGE_SPECS.map((e, i) => ({
		id: `e${String(i + 1).padStart(2, "0")}`,
		fromNode: e.from,
		toNode: e.to,
		fromSide: (e.rework ? "right" : "bottom") as "right" | "bottom",
		toSide: (e.rework ? "right" : "top") as "right" | "top",
		toEnd: "arrow" as const,
		...(e.label ? { label: e.label } : {}),
	}));

	return JSON.stringify({ nodes, edges }, null, "\t");
}

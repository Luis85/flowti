/**
 * Process validation — structural lint rules as pure functions.
 *
 * 10 rules check structural correctness of a ProcessDefinition.
 * Each rule returns an array of ValidationFindings.
 */

import type { ProcessDefinition, ValidationFinding, ValidationResult } from "./types";

// ── Individual rules ────────────────────────────────────────

/** PM-STRUCT-001: Process must contain nodes. */
export function checkHasNodes(def: ProcessDefinition): ValidationFinding[] {
	if (def.nodes.length === 0) {
		return [{ ruleId: "PM-STRUCT-001", severity: "error", message: "Process must contain at least one node" }];
	}
	return [];
}

/** PM-STRUCT-002: Exactly one Start node. */
export function checkSingleStart(def: ProcessDefinition): ValidationFinding[] {
	const starts = def.nodes.filter((n) => n.type === "start");
	if (starts.length === 0) {
		return [{ ruleId: "PM-STRUCT-002", severity: "error", message: "Process must have exactly one Start node" }];
	}
	if (starts.length > 1) {
		return starts.slice(1).map((n) => ({
			ruleId: "PM-STRUCT-002",
			severity: "error",
			message: `Duplicate Start node: "${n.name}"`,
			nodeId: n.id,
		}));
	}
	return [];
}

/** PM-STRUCT-003: At least one End node. */
export function checkHasEnd(def: ProcessDefinition): ValidationFinding[] {
	const ends = def.nodes.filter((n) => n.type === "end");
	if (ends.length === 0) {
		return [{ ruleId: "PM-STRUCT-003", severity: "error", message: "Process must have at least one End node" }];
	}
	return [];
}

/** PM-STRUCT-004: Start must have outgoing edges. */
export function checkStartHasOutgoing(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const starts = def.nodes.filter((n) => n.type === "start");
	for (const start of starts) {
		const outgoing = def.edges.filter((e) => e.fromNode === start.id);
		if (outgoing.length === 0) {
			findings.push({
				ruleId: "PM-STRUCT-004",
				severity: "error",
				message: `Start node "${start.name}" has no outgoing edges`,
				nodeId: start.id,
			});
		}
	}
	return findings;
}

/** PM-STRUCT-005: End must have no outgoing edges. */
export function checkEndNoOutgoing(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const ends = def.nodes.filter((n) => n.type === "end");
	for (const end of ends) {
		const outgoing = def.edges.filter((e) => e.fromNode === end.id);
		if (outgoing.length > 0) {
			findings.push({
				ruleId: "PM-STRUCT-005",
				severity: "error",
				message: `End node "${end.name}" must not have outgoing edges`,
				nodeId: end.id,
			});
		}
	}
	return findings;
}

/** PM-STRUCT-006: No disconnected nodes. */
export function checkNoDisconnected(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const connected = new Set<string>();
	for (const edge of def.edges) {
		connected.add(edge.fromNode);
		connected.add(edge.toNode);
	}
	// Single-node process is valid (just a start or end)
	if (def.nodes.length <= 1) return [];

	for (const node of def.nodes) {
		if (!connected.has(node.id)) {
			findings.push({
				ruleId: "PM-STRUCT-006",
				severity: "error",
				message: `Node "${node.name}" is disconnected (no edges)`,
				nodeId: node.id,
			});
		}
	}
	return findings;
}

/** PM-STRUCT-007: No dead ends (non-end nodes must have outgoing edges). */
export function checkNoDeadEnds(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const outgoingMap = new Set(def.edges.map((e) => e.fromNode));

	for (const node of def.nodes) {
		if (node.type === "end") continue;
		if (!outgoingMap.has(node.id)) {
			// Only flag if node has incoming edges (disconnected is separate rule)
			const hasIncoming = def.edges.some((e) => e.toNode === node.id);
			if (hasIncoming) {
				findings.push({
					ruleId: "PM-STRUCT-007",
					severity: "warning",
					message: `Node "${node.name}" has no outgoing edges (dead end)`,
					nodeId: node.id,
				});
			}
		}
	}
	return findings;
}

/** PM-STRUCT-008: No orphan edges (edges referencing non-existent nodes). */
export function checkNoOrphanEdges(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const nodeIds = new Set(def.nodes.map((n) => n.id));

	for (const edge of def.edges) {
		if (!nodeIds.has(edge.fromNode)) {
			findings.push({
				ruleId: "PM-STRUCT-008",
				severity: "error",
				message: `Edge references non-existent source node: "${edge.fromNode}"`,
			});
		}
		if (!nodeIds.has(edge.toNode)) {
			findings.push({
				ruleId: "PM-STRUCT-008",
				severity: "error",
				message: `Edge references non-existent target node: "${edge.toNode}"`,
			});
		}
	}
	return findings;
}

/** PM-STRUCT-009: Unique node IDs. */
export function checkUniqueNodeIds(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const seen = new Set<string>();

	for (const node of def.nodes) {
		if (seen.has(node.id)) {
			findings.push({
				ruleId: "PM-STRUCT-009",
				severity: "error",
				message: `Duplicate node ID: "${node.id}"`,
				nodeId: node.id,
			});
		}
		seen.add(node.id);
	}
	return findings;
}

/** PM-TYPE-005: Decision nodes must have ≥ 2 outgoing edges. */
export function checkDecisionBranching(def: ProcessDefinition): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const decisions = def.nodes.filter((n) => n.type === "decision");

	for (const decision of decisions) {
		const outgoing = def.edges.filter((e) => e.fromNode === decision.id);
		if (outgoing.length < 2) {
			findings.push({
				ruleId: "PM-TYPE-005",
				severity: "warning",
				message: `Decision node "${decision.name}" should have at least 2 outgoing edges (has ${outgoing.length})`,
				nodeId: decision.id,
			});
		}
	}
	return findings;
}

// ── All rules ───────────────────────────────────────────────

/** All validation rule functions. */
const ALL_RULES = [
	checkHasNodes,
	checkSingleStart,
	checkHasEnd,
	checkStartHasOutgoing,
	checkEndNoOutgoing,
	checkNoDisconnected,
	checkNoDeadEnds,
	checkNoOrphanEdges,
	checkUniqueNodeIds,
	checkDecisionBranching,
];

/**
 * Validates a process definition against all structural rules.
 * Returns a ValidationResult with aggregated findings.
 */
export function validateProcess(def: ProcessDefinition): ValidationResult {
	const findings: ValidationFinding[] = [];
	for (const rule of ALL_RULES) {
		findings.push(...rule(def));
	}

	const errorCount = findings.filter((f) => f.severity === "error").length;
	const warningCount = findings.filter((f) => f.severity === "warning").length;
	const infoCount = findings.filter((f) => f.severity === "info").length;

	return {
		findings,
		errorCount,
		warningCount,
		infoCount,
		valid: errorCount === 0,
	};
}

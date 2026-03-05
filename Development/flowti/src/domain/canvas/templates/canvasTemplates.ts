/**
 * Canvas template library — 5 starter templates for structured visual sessions.
 *
 * Each template is a pure function returning fresh CanvasData with unique IDs.
 * Templates use text nodes as placeholders and groups for spatial organisation.
 */
import type { AllCanvasNodeData, CanvasData, CanvasEdgeData } from "obsidian/canvas";
import type { CanvasTemplate } from "./types";
import { generateCanvasId } from "../CanvasRebuilder";

// ── Layout constants ───────────────────────────────────────────────
const GROUP_W = 460;
const GROUP_H = 400;
const GAP = 40;
const CARD_W = 380;
const CARD_H = 80;
const CARD_PAD = 40; // inset from group origin

function textNode(
	id: string,
	text: string,
	x: number,
	y: number,
	w = CARD_W,
	h = CARD_H,
	color?: string,
): AllCanvasNodeData {
	return { id, type: "text", text, x, y, width: w, height: h, color } as AllCanvasNodeData;
}

function groupNode(
	id: string,
	label: string,
	x: number,
	y: number,
	color: string,
	w = GROUP_W,
	h = GROUP_H,
): AllCanvasNodeData {
	return { id, type: "group", label, x, y, width: w, height: h, color } as AllCanvasNodeData;
}

function edge(
	id: string,
	from: string,
	to: string,
	fromSide: "top" | "bottom" | "left" | "right" = "bottom",
	toSide: "top" | "bottom" | "left" | "right" = "top",
	label?: string,
	color?: string,
): CanvasEdgeData {
	return {
		id,
		fromNode: from,
		toNode: to,
		fromSide,
		toSide,
		fromEnd: "none",
		toEnd: "arrow",
		...(label ? { label } : {}),
		...(color ? { color } : {}),
	} as CanvasEdgeData;
}

// ── 1. Domain Design ───────────────────────────────────────────────

function generateDomainDesign(): CanvasData {
	const gActors = generateCanvasId();
	const gEvents = generateCanvasId();
	const gServices = generateCanvasId();
	const gFlows = generateCanvasId();

	const cActors = generateCanvasId();
	const cEvents = generateCanvasId();
	const cServices = generateCanvasId();
	const cFlows = generateCanvasId();

	const col1 = 0;
	const col2 = GROUP_W + GAP;
	const row1 = 0;
	const row2 = GROUP_H + GAP;

	const nodes: AllCanvasNodeData[] = [
		groupNode(gActors, "Actors", col1, row1, "2"),
		groupNode(gEvents, "Events", col2, row1, "3"),
		groupNode(gServices, "Services", col1, row2, "5"),
		groupNode(gFlows, "Flows", col2, row2, "6"),
		textNode(cActors, "Who interacts with the system?\nAdd actor cards here.", col1 + CARD_PAD, row1 + CARD_PAD + 40),
		textNode(cEvents, "What happens in the domain?\nAdd event cards here.", col2 + CARD_PAD, row1 + CARD_PAD + 40),
		textNode(cServices, "What capabilities are needed?\nAdd service cards here.", col1 + CARD_PAD, row2 + CARD_PAD + 40),
		textNode(cFlows, "How do things flow end-to-end?\nAdd flow cards here.", col2 + CARD_PAD, row2 + CARD_PAD + 40),
	];

	const edges: CanvasEdgeData[] = [
		edge(generateCanvasId(), gActors, gEvents, "right", "left", "triggers", "3"),
		edge(generateCanvasId(), gEvents, gServices, "bottom", "top", "handled by", "5"),
		edge(generateCanvasId(), gServices, gFlows, "right", "left", "composes", "6"),
	];

	return { nodes, edges };
}

// ── 2. Sprint Planning ─────────────────────────────────────────────

function generateSprintPlanning(): CanvasData {
	const gBacklog = generateCanvasId();
	const gGoal = generateCanvasId();
	const gCapacity = generateCanvasId();
	const gCommitment = generateCanvasId();

	const cBacklog = generateCanvasId();
	const cGoal = generateCanvasId();
	const cCapacity = generateCanvasId();
	const cCommitment = generateCanvasId();

	const leftX = 0;
	const rightX = GROUP_W + GAP;
	const rightH = (GROUP_H * 2 + GAP) / 3;

	const nodes: AllCanvasNodeData[] = [
		groupNode(gBacklog, "Backlog", leftX, 0, "3", GROUP_W, GROUP_H * 2 + GAP),
		groupNode(gGoal, "Sprint Goal", rightX, 0, "4", GROUP_W, rightH),
		groupNode(gCapacity, "Capacity", rightX, rightH + GAP, "5", GROUP_W, rightH),
		groupNode(gCommitment, "Commitment", rightX, (rightH + GAP) * 2, "6", GROUP_W, rightH),
		textNode(cBacklog, "Drag candidate items here.\nPrioritise top-to-bottom.", leftX + CARD_PAD, CARD_PAD + 40),
		textNode(cGoal, "What is the sprint goal?", rightX + CARD_PAD, CARD_PAD + 40),
		textNode(cCapacity, "Team capacity notes.\nDays off, dependencies.", rightX + CARD_PAD, rightH + GAP + CARD_PAD + 40),
		textNode(cCommitment, "Committed items for this sprint.", rightX + CARD_PAD, (rightH + GAP) * 2 + CARD_PAD + 40),
	];

	const edges: CanvasEdgeData[] = [
		edge(generateCanvasId(), gBacklog, gCommitment, "right", "left", "selected", "6"),
	];

	return { nodes, edges };
}

// ── 3. Retrospective ───────────────────────────────────────────────

function generateRetrospective(): CanvasData {
	const gWell = generateCanvasId();
	const gImprove = generateCanvasId();
	const gActions = generateCanvasId();

	const cWell = generateCanvasId();
	const cImprove = generateCanvasId();
	const cActions = generateCanvasId();

	const col1 = 0;
	const col2 = GROUP_W + GAP;
	const col3 = (GROUP_W + GAP) * 2;
	const colH = GROUP_H + 200;

	const nodes: AllCanvasNodeData[] = [
		groupNode(gWell, "Went Well", col1, 0, "4", GROUP_W, colH),
		groupNode(gImprove, "Improve", col2, 0, "2", GROUP_W, colH),
		groupNode(gActions, "Action Items", col3, 0, "1", GROUP_W, colH),
		textNode(cWell, "What went well this cycle?\nAdd cards below.", col1 + CARD_PAD, CARD_PAD + 40),
		textNode(cImprove, "What could be improved?\nAdd cards below.", col2 + CARD_PAD, CARD_PAD + 40),
		textNode(cActions, "Concrete next actions.\nAssign owners and dates.", col3 + CARD_PAD, CARD_PAD + 40),
	];

	const edges: CanvasEdgeData[] = [
		edge(generateCanvasId(), gImprove, gActions, "right", "left", "leads to", "1"),
	];

	return { nodes, edges };
}

// ── 4. Brainstorm ──────────────────────────────────────────────────

function generateBrainstorm(): CanvasData {
	const center = generateCanvasId();
	const gNorth = generateCanvasId();
	const gEast = generateCanvasId();
	const gSouth = generateCanvasId();
	const gWest = generateCanvasId();

	const cNorth = generateCanvasId();
	const cEast = generateCanvasId();
	const cSouth = generateCanvasId();
	const cWest = generateCanvasId();

	const cx = 300;
	const cy = 300;
	const zoneOffset = 350;
	const zoneW = 400;
	const zoneH = 300;

	const nodes: AllCanvasNodeData[] = [
		textNode(center, "## Central Topic\nDescribe your brainstorm topic here.", cx - 150, cy - 50, 300, 100, "3"),
		groupNode(gNorth, "Ideas — North", cx - zoneW / 2, cy - zoneOffset - zoneH, "4", zoneW, zoneH),
		groupNode(gEast, "Ideas — East", cx + zoneOffset, cy - zoneH / 2, "5", zoneW, zoneH),
		groupNode(gSouth, "Ideas — South", cx - zoneW / 2, cy + zoneOffset, "2", zoneW, zoneH),
		groupNode(gWest, "Ideas — West", cx - zoneOffset - zoneW, cy - zoneH / 2, "6", zoneW, zoneH),
		textNode(cNorth, "Add ideas here.", cx - zoneW / 2 + CARD_PAD, cy - zoneOffset - zoneH + CARD_PAD + 40),
		textNode(cEast, "Add ideas here.", cx + zoneOffset + CARD_PAD, cy - zoneH / 2 + CARD_PAD + 40),
		textNode(cSouth, "Add ideas here.", cx - zoneW / 2 + CARD_PAD, cy + zoneOffset + CARD_PAD + 40),
		textNode(cWest, "Add ideas here.", cx - zoneOffset - zoneW + CARD_PAD, cy - zoneH / 2 + CARD_PAD + 40),
	];

	const edges: CanvasEdgeData[] = [
		edge(generateCanvasId(), center, gNorth, "top", "bottom"),
		edge(generateCanvasId(), center, gEast, "right", "left"),
		edge(generateCanvasId(), center, gSouth, "bottom", "top"),
		edge(generateCanvasId(), center, gWest, "left", "right"),
	];

	return { nodes, edges };
}

// ── 5. Flow Design ─────────────────────────────────────────────────

function generateFlowDesign(): CanvasData {
	const gStart = generateCanvasId();
	const gSteps = generateCanvasId();
	const gDecisions = generateCanvasId();
	const gEnd = generateCanvasId();

	const cStart = generateCanvasId();
	const cSteps = generateCanvasId();
	const cDecisions = generateCanvasId();
	const cEnd = generateCanvasId();

	const x = 0;
	const stepH = 300;

	const nodes: AllCanvasNodeData[] = [
		groupNode(gStart, "Start", x, 0, "4", GROUP_W, 200),
		groupNode(gSteps, "Steps", x, 200 + GAP, "3", GROUP_W, stepH),
		groupNode(gDecisions, "Decisions", x, 200 + GAP + stepH + GAP, "2", GROUP_W, stepH),
		groupNode(gEnd, "End", x, 200 + GAP + (stepH + GAP) * 2, "1", GROUP_W, 200),
		textNode(cStart, "Entry point.\nWhat triggers this flow?", x + CARD_PAD, CARD_PAD + 40),
		textNode(cSteps, "Sequential steps.\nAdd step cards top-to-bottom.", x + CARD_PAD, 200 + GAP + CARD_PAD + 40),
		textNode(cDecisions, "Decision points.\nAdd diamond-shaped decision cards.", x + CARD_PAD, 200 + GAP + stepH + GAP + CARD_PAD + 40),
		textNode(cEnd, "Outcome / termination.\nWhat is the end state?", x + CARD_PAD, 200 + GAP + (stepH + GAP) * 2 + CARD_PAD + 40),
	];

	const edges: CanvasEdgeData[] = [
		edge(generateCanvasId(), gStart, gSteps, "bottom", "top", "begins"),
		edge(generateCanvasId(), gSteps, gDecisions, "bottom", "top", "reaches"),
		edge(generateCanvasId(), gDecisions, gEnd, "bottom", "top", "resolves"),
	];

	return { nodes, edges };
}

// ── 6. PRD (Product Requirements Definition) ───────────────────────

function generatePRD(): CanvasData {
	const gProblem = generateCanvasId();
	const gUsers = generateCanvasId();
	const gSolution = generateCanvasId();
	const gRisks = generateCanvasId();
	const gSuccess = generateCanvasId();

	const cProblem = generateCanvasId();
	const cUsers = generateCanvasId();
	const cSolution = generateCanvasId();
	const cRisks = generateCanvasId();
	const cSuccess = generateCanvasId();

	const fullW = GROUP_W * 2 + GAP;
	const col1 = 0;
	const col2 = GROUP_W + GAP;
	const row1 = 0;
	const row2 = GROUP_H + GAP;
	const row3 = (GROUP_H + GAP) * 2;

	const nodes: AllCanvasNodeData[] = [
		// Row 1: Problem & Context spans full width
		groupNode(gProblem, "Problem & Context", col1, row1, "1", fullW, GROUP_H),
		textNode(cProblem, "What problem are we solving?\nWho is affected and why does it matter?\nAdd context, pain points, and evidence.", col1 + CARD_PAD, row1 + CARD_PAD + 40, fullW - CARD_PAD * 2),

		// Row 2: Users & Scenarios | Proposed Solution
		groupNode(gUsers, "Users & Scenarios", col1, row2, "4"),
		textNode(cUsers, "Who are the target users?\nWhat are the key use cases?\n\nEach scenario card can become a journey.", col1 + CARD_PAD, row2 + CARD_PAD + 40),

		groupNode(gSolution, "Proposed Solution", col2, row2, "5"),
		textNode(cSolution, "High-level approach.\nKey capabilities and constraints.\nWhat does the first iteration look like?", col2 + CARD_PAD, row2 + CARD_PAD + 40),

		// Row 3: Risks & Constraints | Success Criteria
		groupNode(gRisks, "Risks & Constraints", col1, row3, "2"),
		textNode(cRisks, "What could go wrong?\nAssumptions, dependencies, blockers.\nWhat is explicitly out of scope?", col1 + CARD_PAD, row3 + CARD_PAD + 40),

		groupNode(gSuccess, "Success Criteria", col2, row3, "6"),
		textNode(cSuccess, "How do we know it works?\nAcceptance criteria and metrics.\nDefinition of done for first release.", col2 + CARD_PAD, row3 + CARD_PAD + 40),
	];

	const edges: CanvasEdgeData[] = [
		edge(generateCanvasId(), gProblem, gUsers, "bottom", "top", "informs", "4"),
		edge(generateCanvasId(), gProblem, gSolution, "bottom", "top", "drives", "5"),
		edge(generateCanvasId(), gUsers, gSolution, "right", "left", "shapes", "5"),
		edge(generateCanvasId(), gSolution, gSuccess, "bottom", "top", "validates", "6"),
		edge(generateCanvasId(), gUsers, gRisks, "bottom", "top", "reveals", "2"),
	];

	return { nodes, edges };
}

// ── Registry ───────────────────────────────────────────────────────

export const CANVAS_TEMPLATES: readonly CanvasTemplate[] = [
	{
		id: "domain-design",
		name: "Domain Design",
		description: "Map actors, events, services, and flows for domain modelling.",
		icon: "boxes",
		category: "design",
		generate: generateDomainDesign,
	},
	{
		id: "sprint-planning",
		name: "Sprint Planning",
		description: "Organise backlog, sprint goal, capacity, and commitment.",
		icon: "list-checks",
		category: "planning",
		generate: generateSprintPlanning,
	},
	{
		id: "retrospective",
		name: "Retrospective",
		description: "Capture what went well, areas to improve, and action items.",
		icon: "rotate-ccw",
		category: "reflection",
		generate: generateRetrospective,
	},
	{
		id: "brainstorm",
		name: "Brainstorm",
		description: "Central topic with radial idea zones for divergent thinking.",
		icon: "lightbulb",
		category: "ideation",
		generate: generateBrainstorm,
	},
	{
		id: "flow-design",
		name: "Flow Design",
		description: "Map start, steps, decision points, and end states of a process.",
		icon: "workflow",
		category: "design",
		generate: generateFlowDesign,
	},
	{
		id: "prd",
		name: "Create a PRD",
		description: "Define the problem, users, solution, risks, and success criteria for a new feature.",
		icon: "file-text",
		category: "planning",
		generate: generatePRD,
	},
] as const;

/** Retrieve a template by its ID. Returns undefined if not found. */
export function getCanvasTemplate(id: string): CanvasTemplate | undefined {
	return CANVAS_TEMPLATES.find((t) => t.id === id);
}

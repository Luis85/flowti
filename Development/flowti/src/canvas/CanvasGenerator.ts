/**
 * Canvas Generator for Solution visualization.
 *
 * Generates Obsidian .canvas files from Solution data,
 * showing the relationships between JTBD, Ideas, and Requirements.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../events/types";
import type { Idea, IIdeaService } from "../ideas/types";
import type { JTBD, IJTBDService } from "../jtbd/types";
import { calculateOpportunityScore, getOpportunityLevel } from "../jtbd/types";
import type { Requirement, IRequirementService } from "../requirements/types";
import type { IServiceContainer } from "../services/types";
import type { Solution, ISolutionService } from "../solutions/types";
import {
	CANVAS_COLORS,
	type CanvasData,
	type CanvasNode,
	type CanvasEdge,
	DEFAULT_LAYOUT_CONFIG,
	createTextNode,
	createGroupNode,
	createEdge,
	serializeCanvas,
} from "./types";

/**
 * Options for canvas generation.
 */
export interface CanvasGeneratorOptions {
	app: App;
	services: IServiceContainer;
	eventBus?: IEventBus;
}

/**
 * Result of canvas generation.
 */
export interface CanvasGenerationResult {
	success: boolean;
	canvasPath?: string;
	error?: string;
}

/**
 * Generates canvas visualizations for solutions.
 */
export class CanvasGenerator {
	private app: App;
	private services: IServiceContainer;
	private eventBus?: IEventBus;

	constructor(options: CanvasGeneratorOptions) {
		this.app = options.app;
		this.services = options.services;
		this.eventBus = options.eventBus;
	}

	/**
	 * Generate a canvas for a solution showing JTBD → Idea → Requirement hierarchy.
	 */
	async generateSolutionCanvas(solutionId: string): Promise<CanvasGenerationResult> {
		try {
			// Load solution data
			const solutionService = await this.services.get<ISolutionService>("solutionService");
			const ideaService = await this.services.get<IIdeaService>("ideaService");
			const requirementService = await this.services.get<IRequirementService>("requirementService");
			const jtbdService = await this.services.get<IJTBDService>("jtbdService");

			const solution = await solutionService.load(solutionId);
			if (!solution) {
				return { success: false, error: "Solution not found" };
			}

			const ideas = await ideaService.listBySolution(solutionId);
			const requirements = await requirementService.listBySolution(solutionId);
			const jtbds = await jtbdService.listBySolution(solutionId);

			// Generate canvas data
			const canvasData = this.buildCanvasData(solution, jtbds, ideas, requirements);

			// Determine canvas path
			const solutionsFolder = "Solutions";
			const canvasPath = `${solutionsFolder}/${solution.name}/${solution.name} - Canvas.canvas`;

			// Ensure directory exists
			const folderPath = `${solutionsFolder}/${solution.name}`;
			if (!this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}

			// Write canvas file
			const canvasJson = serializeCanvas(canvasData);
			const existingFile = this.app.vault.getAbstractFileByPath(canvasPath);
			if (existingFile) {
				await this.app.vault.modify(existingFile as never, canvasJson);
			} else {
				await this.app.vault.create(canvasPath, canvasJson);
			}

			// Emit event
			await this.eventBus?.emit("canvas.generated", {
				solutionId,
				canvasPath,
				type: "solution",
			});

			return { success: true, canvasPath };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return { success: false, error: message };
		}
	}

	/**
	 * Build canvas data structure from solution entities.
	 */
	private buildCanvasData(
		solution: Solution,
		jtbds: JTBD[],
		ideas: Idea[],
		requirements: Requirement[]
	): CanvasData {
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];
		const config = DEFAULT_LAYOUT_CONFIG;

		// Track positions
		let currentY = config.startY;
		const nodeMap = new Map<string, string>(); // entity ID -> canvas node ID

		// Calculate total width needed
		const maxColumns = Math.max(jtbds.length, ideas.length, requirements.length, 1);
		const totalWidth = maxColumns * (config.nodeWidth + config.horizontalGap) + config.groupPadding * 2;

		// Row 0: Solution header (group)
		const solutionGroup = createGroupNode(
			`Solution: ${solution.name}`,
			config.startX - config.groupPadding,
			currentY - config.groupPadding,
			totalWidth,
			config.nodeHeight + config.groupPadding * 2,
			{ color: CANVAS_COLORS.purple }
		);
		nodes.push(solutionGroup);

		// Solution info node
		const solutionNode = createTextNode(
			`# ${solution.name}\n\n**Type:** ${solution.type}\n**Phase:** ${solution.currentPhase}`,
			config.startX + totalWidth / 2 - config.nodeWidth / 2,
			currentY,
			{ color: CANVAS_COLORS.purple, width: config.nodeWidth }
		);
		nodes.push(solutionNode);
		currentY += config.nodeHeight + config.verticalGap;

		// Row 1: JTBDs
		if (jtbds.length > 0) {
			const jtbdStartX = config.startX + (totalWidth - jtbds.length * (config.nodeWidth + config.horizontalGap) + config.horizontalGap) / 2;

			for (let i = 0; i < jtbds.length; i++) {
				const jtbd = jtbds[i];
				const x = jtbdStartX + i * (config.nodeWidth + config.horizontalGap);

				const score = calculateOpportunityScore(jtbd.importance, jtbd.satisfaction);
				const level = getOpportunityLevel(score);
				const color = level === "high" ? CANVAS_COLORS.red : level === "medium" ? CANVAS_COLORS.orange : CANVAS_COLORS.yellow;

				const node = createTextNode(
					`## JTBD\n\n${jtbd.jobStatement}\n\n**Opportunity:** ${score}/10`,
					x,
					currentY,
					{ color }
				);
				nodes.push(node);
				nodeMap.set(jtbd.id, node.id);

				// Edge from solution to JTBD
				edges.push(createEdge(solutionNode.id, node.id, {
					fromSide: "bottom",
					toSide: "top",
				}));
			}

			currentY += config.nodeHeight + config.verticalGap;
		}

		// Row 2: Ideas
		if (ideas.length > 0) {
			const ideaStartX = config.startX + (totalWidth - ideas.length * (config.nodeWidth + config.horizontalGap) + config.horizontalGap) / 2;

			for (let i = 0; i < ideas.length; i++) {
				const idea = ideas[i];
				const x = ideaStartX + i * (config.nodeWidth + config.horizontalGap);

				const node = createTextNode(
					`## Idea\n\n**${idea.title}**\n\n${idea.description || ""}\n\n*Status: ${idea.status}*`,
					x,
					currentY,
					{ color: CANVAS_COLORS.yellow }
				);
				nodes.push(node);
				nodeMap.set(idea.id, node.id);

				// Connect to linked JTBD
				for (const jtbd of jtbds) {
					if (jtbd.linkedIdeas?.includes(idea.id)) {
						const jtbdNodeId = nodeMap.get(jtbd.id);
						if (jtbdNodeId) {
							edges.push(createEdge(jtbdNodeId, node.id, {
								fromSide: "bottom",
								toSide: "top",
							}));
						}
					}
				}
			}

			currentY += config.nodeHeight + config.verticalGap;
		}

		// Row 3: Requirements
		if (requirements.length > 0) {
			const reqStartX = config.startX + (totalWidth - requirements.length * (config.nodeWidth + config.horizontalGap) + config.horizontalGap) / 2;

			for (let i = 0; i < requirements.length; i++) {
				const req = requirements[i];
				const x = reqStartX + i * (config.nodeWidth + config.horizontalGap);

				const color = req.status === "Approved" || req.status === "Satisfied"
					? CANVAS_COLORS.green
					: CANVAS_COLORS.blue;

				const node = createTextNode(
					`## Requirement\n\n**${req.title}**\n\nPriority: ${req.priority}\nStatus: ${req.status}`,
					x,
					currentY,
					{ color }
				);
				nodes.push(node);
				nodeMap.set(req.id, node.id);

				// Connect to linked Ideas (Requirements have linkedIdeas)
				if (req.linkedIdeas) {
					for (const ideaId of req.linkedIdeas) {
						const ideaNodeId = nodeMap.get(ideaId);
						if (ideaNodeId) {
							edges.push(createEdge(ideaNodeId, node.id, {
								fromSide: "bottom",
								toSide: "top",
							}));
						}
					}
				}
			}
		}

		return { nodes, edges };
	}

	/**
	 * Generate a traceability canvas showing all relationships.
	 */
	async generateTraceabilityCanvas(solutionId: string): Promise<CanvasGenerationResult> {
		try {
			// Load solution data
			const solutionService = await this.services.get<ISolutionService>("solutionService");
			const ideaService = await this.services.get<IIdeaService>("ideaService");
			const requirementService = await this.services.get<IRequirementService>("requirementService");
			const jtbdService = await this.services.get<IJTBDService>("jtbdService");

			const solution = await solutionService.load(solutionId);
			if (!solution) {
				return { success: false, error: "Solution not found" };
			}

			const ideas = await ideaService.listBySolution(solutionId);
			const requirements = await requirementService.listBySolution(solutionId);
			const jtbds = await jtbdService.listBySolution(solutionId);

			// Generate canvas data with traceability focus
			const canvasData = this.buildTraceabilityCanvasData(solution, jtbds, ideas, requirements);

			// Determine canvas path
			const solutionsFolder = "Solutions";
			const canvasPath = `${solutionsFolder}/${solution.name}/${solution.name} - Traceability.canvas`;

			// Ensure directory exists
			const folderPath = `${solutionsFolder}/${solution.name}`;
			if (!this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}

			// Write canvas file
			const canvasJson = serializeCanvas(canvasData);
			const existingFile = this.app.vault.getAbstractFileByPath(canvasPath);
			if (existingFile) {
				await this.app.vault.modify(existingFile as never, canvasJson);
			} else {
				await this.app.vault.create(canvasPath, canvasJson);
			}

			// Emit event
			await this.eventBus?.emit("canvas.generated", {
				solutionId,
				canvasPath,
				type: "traceability",
			});

			return { success: true, canvasPath };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return { success: false, error: message };
		}
	}

	/**
	 * Build traceability canvas with column-based layout.
	 */
	private buildTraceabilityCanvasData(
		solution: Solution,
		jtbds: JTBD[],
		ideas: Idea[],
		requirements: Requirement[]
	): CanvasData {
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];
		const config = { ...DEFAULT_LAYOUT_CONFIG };

		// Smaller nodes for matrix view
		config.nodeWidth = 250;
		config.nodeHeight = 100;
		config.horizontalGap = 100;
		config.verticalGap = 50;

		const nodeMap = new Map<string, string>();

		// Column headers
		const columnWidth = config.nodeWidth + config.horizontalGap;
		const headerY = config.startY;

		// JTBD column header
		const jtbdHeader = createTextNode(
			"## Jobs to be Done",
			config.startX,
			headerY,
			{ color: CANVAS_COLORS.orange, width: config.nodeWidth, height: 60 }
		);
		nodes.push(jtbdHeader);

		// Ideas column header
		const ideasHeader = createTextNode(
			"## Ideas",
			config.startX + columnWidth,
			headerY,
			{ color: CANVAS_COLORS.yellow, width: config.nodeWidth, height: 60 }
		);
		nodes.push(ideasHeader);

		// Requirements column header
		const reqHeader = createTextNode(
			"## Requirements",
			config.startX + columnWidth * 2,
			headerY,
			{ color: CANVAS_COLORS.green, width: config.nodeWidth, height: 60 }
		);
		nodes.push(reqHeader);

		const currentY = headerY + 60 + config.verticalGap;

		// Place JTBDs in column 0
		for (let i = 0; i < jtbds.length; i++) {
			const jtbd = jtbds[i];
			const score = calculateOpportunityScore(jtbd.importance, jtbd.satisfaction);
			const level = getOpportunityLevel(score);
			const color = level === "high" ? CANVAS_COLORS.red : level === "medium" ? CANVAS_COLORS.orange : CANVAS_COLORS.yellow;

			const node = createTextNode(
				`${jtbd.jobStatement.slice(0, 80)}${jtbd.jobStatement.length > 80 ? "..." : ""}\n\n*Opp: ${score}/10*`,
				config.startX,
				currentY + i * (config.nodeHeight + config.verticalGap),
				{ color, width: config.nodeWidth, height: config.nodeHeight }
			);
			nodes.push(node);
			nodeMap.set(jtbd.id, node.id);
		}

		// Place Ideas in column 1
		for (let i = 0; i < ideas.length; i++) {
			const idea = ideas[i];
			const node = createTextNode(
				`**${idea.title}**\n\n*${idea.status}*`,
				config.startX + columnWidth,
				currentY + i * (config.nodeHeight + config.verticalGap),
				{ color: CANVAS_COLORS.yellow, width: config.nodeWidth, height: config.nodeHeight }
			);
			nodes.push(node);
			nodeMap.set(idea.id, node.id);

			// Connect to linked JTBD
			for (const jtbd of jtbds) {
				if (jtbd.linkedIdeas?.includes(idea.id)) {
					const jtbdNodeId = nodeMap.get(jtbd.id);
					if (jtbdNodeId) {
						edges.push(createEdge(jtbdNodeId, node.id, {
							fromSide: "right",
							toSide: "left",
						}));
					}
				}
			}
		}

		// Place Requirements in column 2
		for (let i = 0; i < requirements.length; i++) {
			const req = requirements[i];
			const color = req.status === "Approved" || req.status === "Satisfied"
				? CANVAS_COLORS.green
				: CANVAS_COLORS.blue;

			const node = createTextNode(
				`**${req.title}**\n\n*${req.priority} | ${req.status}*`,
				config.startX + columnWidth * 2,
				currentY + i * (config.nodeHeight + config.verticalGap),
				{ color, width: config.nodeWidth, height: config.nodeHeight }
			);
			nodes.push(node);
			nodeMap.set(req.id, node.id);

			// Connect to linked Ideas (Requirements have linkedIdeas)
			if (req.linkedIdeas) {
				for (const ideaId of req.linkedIdeas) {
					const ideaNodeId = nodeMap.get(ideaId);
					if (ideaNodeId) {
						edges.push(createEdge(ideaNodeId, node.id, {
							fromSide: "right",
							toSide: "left",
						}));
					}
				}
			}
		}

		return { nodes, edges };
	}
}

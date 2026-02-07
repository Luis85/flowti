import type { App, TFile } from "obsidian";
import { ValidationError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import { generateUUID } from "../utils/helpers";
import type {
	CreateSolutionInput,
	ISolutionService,
	Solution,
	SolutionFrontmatter,
	SolutionServiceOptions,
} from "./types";
import { SolutionFrontmatterSchema } from "./types";

/**
 * Default folder for storing solution files.
 */
const DEFAULT_SOLUTIONS_FOLDER = "Solutions";

/**
 * Service for managing solutions within the Flowti plugin.
 * Solutions are stored as markdown files with YAML frontmatter.
 */
export class SolutionService implements ISolutionService {
	private app: App;
	private eventBus?: IEventBus;
	private solutionsFolder: string;

	constructor(options: SolutionServiceOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.solutionsFolder = options.solutionsFolder ?? DEFAULT_SOLUTIONS_FOLDER;
	}

	/**
	 * Create a new solution.
	 * Creates a markdown file in the solutions folder with frontmatter.
	 */
	async create(input: CreateSolutionInput): Promise<Solution> {
		const name = input.name.trim();
		if (!name) {
			throw new ValidationError({
				code: "INVALID_SOLUTION_NAME",
				message: "Solution name cannot be empty",
				severity: "medium",
				context: "SolutionService.create",
			});
		}

		// Check if solution with this name already exists
		const existing = await this.getByName(name);
		if (existing) {
			throw new ValidationError({
				code: "SOLUTION_ALREADY_EXISTS",
				message: `A solution with the name "${name}" already exists`,
				severity: "medium",
				context: "SolutionService.create",
			});
		}

		const now = new Date().toISOString();
		const solution: Solution = {
			id: generateUUID(),
			name,
			type: input.type,
			description: input.description,
			currentPhase: "Ideate",
			createdAt: now,
			updatedAt: now,
		};

		// Create the markdown file
		await this.createSolutionFile(solution);

		await this.eventBus?.emit("solution.created", { solution });

		return solution;
	}

	/**
	 * Load a solution by its UUID.
	 */
	async load(id: string): Promise<Solution | null> {
		const files = await this.getSolutionFiles();

		for (const file of files) {
			const solution = await this.parseSolutionFile(file);
			if (solution && solution.id === id) {
				await this.eventBus?.emit("solution.loaded", { solution });
				return solution;
			}
		}

		return null;
	}

	/**
	 * Get a solution by its name.
	 */
	async getByName(name: string): Promise<Solution | null> {
		const files = await this.getSolutionFiles();
		const normalizedName = name.toLowerCase().trim();

		for (const file of files) {
			const solution = await this.parseSolutionFile(file);
			if (solution && solution.name.toLowerCase() === normalizedName) {
				return solution;
			}
		}

		return null;
	}

	/**
	 * List all solutions.
	 */
	async list(): Promise<Solution[]> {
		const files = await this.getSolutionFiles();
		const solutions: Solution[] = [];

		for (const file of files) {
			const solution = await this.parseSolutionFile(file);
			if (solution) {
				solutions.push(solution);
			}
		}

		// Sort by creation date, newest first
		return solutions.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * Update a solution.
	 */
	async update(
		id: string,
		updates: Partial<CreateSolutionInput>
	): Promise<Solution> {
		const solution = await this.load(id);
		if (!solution) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution with ID "${id}" not found`,
				severity: "medium",
				context: "SolutionService.update",
			});
		}

		const updatedSolution: Solution = {
			...solution,
			...updates,
			name: updates.name?.trim() ?? solution.name,
			updatedAt: new Date().toISOString(),
		};

		// If name changed, we need to rename the file
		if (updates.name && updates.name.trim() !== solution.name) {
			await this.renameSolutionFile(solution.name, updatedSolution.name);
		}

		await this.updateSolutionFile(updatedSolution);
		await this.eventBus?.emit("solution.updated", { solution: updatedSolution });

		return updatedSolution;
	}

	/**
	 * Delete a solution.
	 */
	async delete(id: string): Promise<void> {
		const solution = await this.load(id);
		if (!solution) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution with ID "${id}" not found`,
				severity: "medium",
				context: "SolutionService.delete",
			});
		}

		const filePath = this.getSolutionFilePath(solution.name);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file instanceof this.app.vault.adapter.constructor) {
			await this.app.vault.delete(file as TFile);
		}

		await this.eventBus?.emit("solution.deleted", { solutionId: id });
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Private Methods
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Ensure the solutions folder exists.
	 */
	private async ensureSolutionsFolder(): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(this.solutionsFolder);
		if (!folder) {
			await this.app.vault.createFolder(this.solutionsFolder);
		}
	}

	/**
	 * Get the file path for a solution.
	 */
	private getSolutionFilePath(name: string): string {
		// Sanitize name for file system
		const sanitizedName = name.replace(/[\\/:*?"<>|]/g, "-");
		return `${this.solutionsFolder}/${sanitizedName}.md`;
	}

	/**
	 * Get all markdown files in the solutions folder.
	 */
	private async getSolutionFiles(): Promise<TFile[]> {
		await this.ensureSolutionsFolder();

		const folder = this.app.vault.getAbstractFileByPath(this.solutionsFolder);
		if (!folder) {
			return [];
		}

		const files: TFile[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		for (const file of allFiles) {
			if (file.path.startsWith(this.solutionsFolder + "/")) {
				files.push(file);
			}
		}

		return files;
	}

	/**
	 * Create a markdown file for a solution.
	 */
	private async createSolutionFile(solution: Solution): Promise<void> {
		await this.ensureSolutionsFolder();

		const filePath = this.getSolutionFilePath(solution.name);
		const content = this.generateFileContent(solution);

		await this.app.vault.create(filePath, content);
	}

	/**
	 * Update a solution's markdown file.
	 */
	private async updateSolutionFile(solution: Solution): Promise<void> {
		const filePath = this.getSolutionFilePath(solution.name);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof Object) || !("path" in file)) {
			throw new ValidationError({
				code: "SOLUTION_FILE_NOT_FOUND",
				message: `Solution file not found: ${filePath}`,
				severity: "medium",
				context: "SolutionService.updateSolutionFile",
			});
		}

		const content = this.generateFileContent(solution);
		await this.app.vault.modify(file as TFile, content);
	}

	/**
	 * Rename a solution file.
	 */
	private async renameSolutionFile(
		oldName: string,
		newName: string
	): Promise<void> {
		const oldPath = this.getSolutionFilePath(oldName);
		const newPath = this.getSolutionFilePath(newName);

		const file = this.app.vault.getAbstractFileByPath(oldPath);
		if (file) {
			await this.app.fileManager.renameFile(file as TFile, newPath);
		}
	}

	/**
	 * Generate markdown content for a solution.
	 */
	private generateFileContent(solution: Solution): string {
		const frontmatter: SolutionFrontmatter = {
			id: solution.id,
			type: solution.type,
			currentPhase: solution.currentPhase,
			createdAt: solution.createdAt,
			updatedAt: solution.updatedAt,
		};

		const lines: string[] = [
			"---",
			`id: "${frontmatter.id}"`,
			`type: "${frontmatter.type}"`,
			`currentPhase: "${frontmatter.currentPhase}"`,
			`createdAt: "${frontmatter.createdAt}"`,
			`updatedAt: "${frontmatter.updatedAt}"`,
			"---",
			"",
			`# ${solution.name}`,
			"",
		];

		if (solution.description) {
			lines.push(`> ${solution.description}`, "");
		}

		lines.push("## Problem Statement", "", "*Describe the problem this solution addresses...*", "");
		lines.push("## Vision", "", "*Describe the desired outcome...*", "");

		return lines.join("\n");
	}

	/**
	 * Parse a solution from a markdown file.
	 */
	private async parseSolutionFile(file: TFile): Promise<Solution | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatter = this.parseFrontmatter(content);

			if (!frontmatter) {
				return null;
			}

			const result = SolutionFrontmatterSchema.safeParse(frontmatter);
			if (!result.success) {
				return null;
			}

			// Extract name from H1 heading or filename
			const name = this.extractName(content, file.basename);

			// Extract description from blockquote
			const description = this.extractDescription(content);

			return {
				id: result.data.id,
				name,
				type: result.data.type,
				description,
				currentPhase: result.data.currentPhase,
				createdAt: result.data.createdAt,
				updatedAt: result.data.updatedAt,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Parse YAML frontmatter from markdown content.
	 */
	private parseFrontmatter(content: string): Record<string, unknown> | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) {
			return null;
		}

		const yamlContent = match[1];
		const frontmatter: Record<string, unknown> = {};

		for (const line of yamlContent.split("\n")) {
			const colonIndex = line.indexOf(":");
			if (colonIndex > 0) {
				const key = line.slice(0, colonIndex).trim();
				let value = line.slice(colonIndex + 1).trim();

				// Remove quotes if present
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}

				frontmatter[key] = value;
			}
		}

		return frontmatter;
	}

	/**
	 * Extract the solution name from H1 heading or fallback to filename.
	 */
	private extractName(content: string, fallback: string): string {
		const match = content.match(/^#\s+(.+)$/m);
		return match ? match[1].trim() : fallback;
	}

	/**
	 * Extract description from first blockquote.
	 */
	private extractDescription(content: string): string | undefined {
		const match = content.match(/^>\s+(.+)$/m);
		return match ? match[1].trim() : undefined;
	}
}

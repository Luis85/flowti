import type { App, TFile } from "obsidian";
import { ValidationError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import type { ISolutionService } from "../solutions/types";
import { generateUUID } from "../utils/helpers";
import type {
	CreateJTBDInput,
	JTBD,
	JTBDFrontmatter,
	JTBDServiceOptions,
	IJTBDService,
	UpdateJTBDInput,
} from "./types";
import { JTBDFrontmatterSchema } from "./types";

/**
 * Default folder for storing solution files.
 */
const DEFAULT_SOLUTIONS_FOLDER = "Solutions";

/**
 * Subfolder name for JTBDs within a solution folder.
 */
const JTBD_SUBFOLDER = "JTBD";

/**
 * Service for managing Jobs to be Done within the Flowti plugin.
 * JTBDs are stored as markdown files in solution subfolders.
 */
export class JTBDService implements IJTBDService {
	private app: App;
	private eventBus?: IEventBus;
	private solutionsFolder: string;
	private solutionService?: ISolutionService;

	constructor(options: JTBDServiceOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.solutionsFolder = options.solutionsFolder ?? DEFAULT_SOLUTIONS_FOLDER;
	}

	/**
	 * Set the solution service for resolving solution names.
	 * Called during service initialization.
	 */
	setSolutionService(solutionService: ISolutionService): void {
		this.solutionService = solutionService;
	}

	/**
	 * Create a new JTBD within a solution.
	 */
	async create(input: CreateJTBDInput): Promise<JTBD> {
		const jobStatement = input.jobStatement.trim();
		if (!jobStatement) {
			throw new ValidationError({
				code: "INVALID_JTBD_STATEMENT",
				message: "Job statement cannot be empty",
				severity: "medium",
				context: "JTBDService.create",
			});
		}

		// Verify solution exists
		const solutionName = await this.resolveSolutionName(input.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution with ID "${input.solutionId}" not found`,
				severity: "medium",
				context: "JTBDService.create",
			});
		}

		const now = new Date().toISOString();
		const jtbd: JTBD = {
			id: generateUUID(),
			jobStatement,
			context: input.context,
			motivation: input.motivation,
			outcome: input.outcome,
			importance: input.importance ?? 3,
			satisfaction: input.satisfaction ?? 3,
			status: "Active",
			solutionId: input.solutionId,
			linkedRequirements: undefined,
			linkedIdeas: undefined,
			createdAt: now,
			updatedAt: now,
		};

		await this.ensureJTBDFolder(solutionName);
		await this.createJTBDFile(jtbd, solutionName);

		await this.eventBus?.emit("jtbd.created", { jtbd });

		return jtbd;
	}

	/**
	 * Load a JTBD by its UUID.
	 */
	async load(id: string): Promise<JTBD | null> {
		const allJTBDs = await this.listAll();
		const jtbd = allJTBDs.find((j) => j.id === id);

		if (jtbd) {
			await this.eventBus?.emit("jtbd.loaded", { jtbd });
		}

		return jtbd ?? null;
	}

	/**
	 * List all JTBDs for a specific solution.
	 */
	async listBySolution(solutionId: string): Promise<JTBD[]> {
		const solutionName = await this.resolveSolutionName(solutionId);
		if (!solutionName) {
			return [];
		}

		const jtbdFolder = this.getJTBDFolderPath(solutionName);
		const files = await this.getJTBDFiles(jtbdFolder);
		const jtbds: JTBD[] = [];

		for (const file of files) {
			const jtbd = await this.parseJTBDFile(file);
			if (jtbd && jtbd.solutionId === solutionId) {
				jtbds.push(jtbd);
			}
		}

		return jtbds.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * List all JTBDs across all solutions.
	 */
	async listAll(): Promise<JTBD[]> {
		const jtbds: JTBD[] = [];
		const solutionFolders = await this.getSolutionFolders();

		for (const folderName of solutionFolders) {
			const jtbdFolder = this.getJTBDFolderPath(folderName);
			const files = await this.getJTBDFiles(jtbdFolder);

			for (const file of files) {
				const jtbd = await this.parseJTBDFile(file);
				if (jtbd) {
					jtbds.push(jtbd);
				}
			}
		}

		return jtbds.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * Update a JTBD.
	 */
	async update(id: string, updates: UpdateJTBDInput): Promise<JTBD> {
		const jtbd = await this.load(id);
		if (!jtbd) {
			throw new ValidationError({
				code: "JTBD_NOT_FOUND",
				message: `JTBD with ID "${id}" not found`,
				severity: "medium",
				context: "JTBDService.update",
			});
		}

		const solutionName = await this.resolveSolutionName(jtbd.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for JTBD not found`,
				severity: "medium",
				context: "JTBDService.update",
			});
		}

		const oldJobStatement = jtbd.jobStatement;
		const updatedJTBD: JTBD = {
			...jtbd,
			jobStatement: updates.jobStatement?.trim() ?? jtbd.jobStatement,
			context: updates.context ?? jtbd.context,
			motivation: updates.motivation ?? jtbd.motivation,
			outcome: updates.outcome ?? jtbd.outcome,
			importance: updates.importance ?? jtbd.importance,
			satisfaction: updates.satisfaction ?? jtbd.satisfaction,
			status: updates.status ?? jtbd.status,
			linkedRequirements: updates.linkedRequirements ?? jtbd.linkedRequirements,
			linkedIdeas: updates.linkedIdeas ?? jtbd.linkedIdeas,
			updatedAt: new Date().toISOString(),
		};

		// If job statement changed, rename the file
		if (updates.jobStatement && updates.jobStatement.trim() !== oldJobStatement) {
			await this.renameJTBDFile(oldJobStatement, updatedJTBD.jobStatement, solutionName);
		}

		await this.updateJTBDFile(updatedJTBD, solutionName);
		await this.eventBus?.emit("jtbd.updated", { jtbd: updatedJTBD });

		return updatedJTBD;
	}

	/**
	 * Delete a JTBD.
	 */
	async delete(id: string): Promise<void> {
		const jtbd = await this.load(id);
		if (!jtbd) {
			throw new ValidationError({
				code: "JTBD_NOT_FOUND",
				message: `JTBD with ID "${id}" not found`,
				severity: "medium",
				context: "JTBDService.delete",
			});
		}

		const solutionName = await this.resolveSolutionName(jtbd.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for JTBD not found`,
				severity: "medium",
				context: "JTBDService.delete",
			});
		}

		const filePath = this.getJTBDFilePath(jtbd.jobStatement, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file) {
			await this.app.vault.delete(file as TFile);
		}

		await this.eventBus?.emit("jtbd.deleted", {
			jtbdId: id,
			solutionId: jtbd.solutionId,
		});
	}

	/**
	 * Get JTBDs linked to a specific idea.
	 */
	async getByLinkedIdea(ideaId: string): Promise<JTBD[]> {
		const allJTBDs = await this.listAll();
		return allJTBDs.filter(
			(jtbd) => jtbd.linkedIdeas?.includes(ideaId as JTBD["id"])
		);
	}

	/**
	 * Get JTBDs linked to a specific requirement.
	 */
	async getByLinkedRequirement(requirementId: string): Promise<JTBD[]> {
		const allJTBDs = await this.listAll();
		return allJTBDs.filter(
			(jtbd) => jtbd.linkedRequirements?.includes(requirementId as JTBD["id"])
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Private Methods
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Resolve solution name from solution ID.
	 */
	private async resolveSolutionName(solutionId: string): Promise<string | null> {
		if (this.solutionService) {
			const solution = await this.solutionService.load(solutionId);
			return solution?.name ?? null;
		}

		// Fallback: scan solution files to find matching ID
		const solutionFolders = await this.getSolutionFolders();
		for (const folderName of solutionFolders) {
			const solutionFilePath = `${this.solutionsFolder}/${folderName}/${folderName}.md`;
			const file = this.app.vault.getAbstractFileByPath(solutionFilePath);
			if (file) {
				const content = await this.app.vault.read(file as TFile);
				const frontmatter = this.parseFrontmatter(content);
				if (frontmatter?.id === solutionId) {
					return folderName;
				}
			}
		}

		// Also check flat structure (Solutions/Name.md)
		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			if (file.path.startsWith(this.solutionsFolder + "/") && !file.path.includes(`/${JTBD_SUBFOLDER}/`)) {
				const content = await this.app.vault.read(file);
				const frontmatter = this.parseFrontmatter(content);
				if (frontmatter?.id === solutionId) {
					return file.basename;
				}
			}
		}

		return null;
	}

	/**
	 * Get all solution folder names.
	 */
	private async getSolutionFolders(): Promise<string[]> {
		const folders: string[] = [];
		const solutionFolder = this.app.vault.getAbstractFileByPath(this.solutionsFolder);

		if (!solutionFolder) {
			return folders;
		}

		// Check for subfolders in Solutions directory
		const allFiles = this.app.vault.getAllLoadedFiles();
		for (const file of allFiles) {
			if (file.path.startsWith(this.solutionsFolder + "/")) {
				const relativePath = file.path.slice(this.solutionsFolder.length + 1);
				const parts = relativePath.split("/");
				if (parts.length >= 1 && parts[0] && !folders.includes(parts[0])) {
					// Check if it's a folder (has children or is a .md file's basename)
					if (!parts[0].endsWith(".md")) {
						folders.push(parts[0]);
					}
				}
			}
		}

		// Also consider flat structure: Solutions/Name.md -> Name
		const markdownFiles = this.app.vault.getMarkdownFiles();
		for (const file of markdownFiles) {
			if (file.path.startsWith(this.solutionsFolder + "/") && file.path.split("/").length === 2) {
				const baseName = file.basename;
				if (!folders.includes(baseName)) {
					folders.push(baseName);
				}
			}
		}

		return folders;
	}

	/**
	 * Get the JTBD folder path for a solution.
	 */
	private getJTBDFolderPath(solutionName: string): string {
		return `${this.solutionsFolder}/${solutionName}/${JTBD_SUBFOLDER}`;
	}

	/**
	 * Get the file path for a JTBD.
	 */
	private getJTBDFilePath(jobStatement: string, solutionName: string): string {
		const sanitizedStatement = this.sanitizeFilename(jobStatement);
		return `${this.getJTBDFolderPath(solutionName)}/${sanitizedStatement}.md`;
	}

	/**
	 * Sanitize a string to be used as a filename.
	 * Truncates long statements and removes invalid characters.
	 */
	private sanitizeFilename(text: string): string {
		// Take first 50 chars or up to first comma/period
		let filename = text.slice(0, 50);
		const punctuationIndex = filename.search(/[,.\n]/);
		if (punctuationIndex > 10) {
			filename = filename.slice(0, punctuationIndex);
		}

		// Replace invalid characters
		return filename.replace(/[\\/:*?"<>|]/g, "-").trim();
	}

	/**
	 * Ensure the JTBD folder exists for a solution.
	 */
	private async ensureJTBDFolder(solutionName: string): Promise<void> {
		const solutionFolderPath = `${this.solutionsFolder}/${solutionName}`;
		const jtbdFolderPath = this.getJTBDFolderPath(solutionName);

		// Ensure solution folder exists
		const solutionFolder = this.app.vault.getAbstractFileByPath(solutionFolderPath);
		if (!solutionFolder) {
			await this.app.vault.createFolder(solutionFolderPath);
		}

		// Ensure JTBD subfolder exists
		const jtbdFolder = this.app.vault.getAbstractFileByPath(jtbdFolderPath);
		if (!jtbdFolder) {
			await this.app.vault.createFolder(jtbdFolderPath);
		}
	}

	/**
	 * Get all JTBD markdown files in a folder.
	 */
	private async getJTBDFiles(folderPath: string): Promise<TFile[]> {
		const files: TFile[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		for (const file of allFiles) {
			if (file.path.startsWith(folderPath + "/")) {
				files.push(file);
			}
		}

		return files;
	}

	/**
	 * Create a markdown file for a JTBD.
	 */
	private async createJTBDFile(jtbd: JTBD, solutionName: string): Promise<void> {
		const filePath = this.getJTBDFilePath(jtbd.jobStatement, solutionName);
		const content = this.generateFileContent(jtbd);
		await this.app.vault.create(filePath, content);
	}

	/**
	 * Update a JTBD's markdown file.
	 */
	private async updateJTBDFile(jtbd: JTBD, solutionName: string): Promise<void> {
		const filePath = this.getJTBDFilePath(jtbd.jobStatement, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file) {
			throw new ValidationError({
				code: "JTBD_FILE_NOT_FOUND",
				message: `JTBD file not found: ${filePath}`,
				severity: "medium",
				context: "JTBDService.updateJTBDFile",
			});
		}

		const content = this.generateFileContent(jtbd);
		await this.app.vault.modify(file as TFile, content);
	}

	/**
	 * Rename a JTBD file.
	 */
	private async renameJTBDFile(
		oldStatement: string,
		newStatement: string,
		solutionName: string
	): Promise<void> {
		const oldPath = this.getJTBDFilePath(oldStatement, solutionName);
		const newPath = this.getJTBDFilePath(newStatement, solutionName);

		const file = this.app.vault.getAbstractFileByPath(oldPath);
		if (file) {
			await this.app.fileManager.renameFile(file as TFile, newPath);
		}
	}

	/**
	 * Generate markdown content for a JTBD.
	 */
	private generateFileContent(jtbd: JTBD): string {
		const frontmatter: JTBDFrontmatter = {
			id: jtbd.id,
			status: jtbd.status,
			solutionId: jtbd.solutionId,
			importance: jtbd.importance,
			satisfaction: jtbd.satisfaction,
			linkedRequirements: jtbd.linkedRequirements,
			linkedIdeas: jtbd.linkedIdeas,
			createdAt: jtbd.createdAt,
			updatedAt: jtbd.updatedAt,
		};

		const lines: string[] = [
			"---",
			`id: "${frontmatter.id}"`,
			`status: "${frontmatter.status}"`,
			`solutionId: "${frontmatter.solutionId}"`,
			`importance: ${frontmatter.importance}`,
			`satisfaction: ${frontmatter.satisfaction}`,
		];

		// Add arrays if present
		if (frontmatter.linkedRequirements && frontmatter.linkedRequirements.length > 0) {
			lines.push("linkedRequirements:");
			for (const reqId of frontmatter.linkedRequirements) {
				lines.push(`  - "${reqId}"`);
			}
		}

		if (frontmatter.linkedIdeas && frontmatter.linkedIdeas.length > 0) {
			lines.push("linkedIdeas:");
			for (const ideaId of frontmatter.linkedIdeas) {
				lines.push(`  - "${ideaId}"`);
			}
		}

		lines.push(
			`createdAt: "${frontmatter.createdAt}"`,
			`updatedAt: "${frontmatter.updatedAt}"`,
			"---",
			"",
			`# ${jtbd.jobStatement}`,
			""
		);

		// Add structured sections
		lines.push("## Context");
		if (jtbd.context) {
			lines.push(jtbd.context, "");
		} else {
			lines.push("*When does this job arise? What triggers it?*", "");
		}

		lines.push("## Motivation");
		if (jtbd.motivation) {
			lines.push(jtbd.motivation, "");
		} else {
			lines.push("*What action or desire does the user have?*", "");
		}

		lines.push("## Desired Outcome");
		if (jtbd.outcome) {
			lines.push(jtbd.outcome, "");
		} else {
			lines.push("*What result does the user expect?*", "");
		}

		return lines.join("\n");
	}

	/**
	 * Parse a JTBD from a markdown file.
	 */
	private async parseJTBDFile(file: TFile): Promise<JTBD | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatter = this.parseFrontmatterWithArrays(content);

			if (!frontmatter) {
				return null;
			}

			const result = JTBDFrontmatterSchema.safeParse(frontmatter);
			if (!result.success) {
				return null;
			}

			const jobStatement = this.extractTitle(content, file.basename);
			const { context, motivation, outcome } = this.extractSections(content);

			return {
				id: result.data.id,
				jobStatement,
				context,
				motivation,
				outcome,
				importance: result.data.importance,
				satisfaction: result.data.satisfaction,
				status: result.data.status,
				solutionId: result.data.solutionId,
				linkedRequirements: result.data.linkedRequirements as JTBD["linkedRequirements"],
				linkedIdeas: result.data.linkedIdeas as JTBD["linkedIdeas"],
				createdAt: result.data.createdAt,
				updatedAt: result.data.updatedAt,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Parse YAML frontmatter from markdown content, including arrays.
	 */
	private parseFrontmatterWithArrays(content: string): Record<string, unknown> | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) {
			return null;
		}

		const yamlContent = match[1];
		const frontmatter: Record<string, unknown> = {};
		const lines = yamlContent.split("\n");

		let currentArrayKey: string | null = null;
		let currentArray: string[] = [];

		for (const line of lines) {
			// Check if it's an array item
			if (line.startsWith("  - ")) {
				if (currentArrayKey) {
					let value = line.slice(4).trim();
					// Remove quotes if present
					if (
						(value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))
					) {
						value = value.slice(1, -1);
					}
					currentArray.push(value);
				}
				continue;
			}

			// Save any pending array
			if (currentArrayKey && currentArray.length > 0) {
				frontmatter[currentArrayKey] = currentArray;
				currentArrayKey = null;
				currentArray = [];
			}

			const colonIndex = line.indexOf(":");
			if (colonIndex > 0) {
				const key = line.slice(0, colonIndex).trim();
				let value = line.slice(colonIndex + 1).trim();

				// Check if this is the start of an array
				if (value === "" || value === "[]") {
					currentArrayKey = key;
					currentArray = [];
					continue;
				}

				// Remove quotes if present
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}

				// Parse numbers
				if (/^\d+$/.test(value)) {
					frontmatter[key] = parseInt(value, 10);
				} else {
					frontmatter[key] = value;
				}
			}
		}

		// Save final array if any
		if (currentArrayKey && currentArray.length > 0) {
			frontmatter[currentArrayKey] = currentArray;
		}

		return frontmatter;
	}

	/**
	 * Parse YAML frontmatter from markdown content (simple version).
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
	 * Extract the job statement from H1 heading or fallback to filename.
	 */
	private extractTitle(content: string, fallback: string): string {
		const match = content.match(/^#\s+(.+)$/m);
		return match ? match[1].trim() : fallback;
	}

	/**
	 * Extract the context, motivation, and outcome sections.
	 */
	private extractSections(content: string): {
		context?: string;
		motivation?: string;
		outcome?: string;
	} {
		const result: { context?: string; motivation?: string; outcome?: string } = {};

		// Extract Context section
		const contextMatch = content.match(/##\s+Context\n\n([\s\S]*?)(?=\n##|$)/);
		if (contextMatch) {
			const value = contextMatch[1].trim();
			if (value && !value.startsWith("*")) {
				result.context = value;
			}
		}

		// Extract Motivation section
		const motivationMatch = content.match(/##\s+Motivation\n\n([\s\S]*?)(?=\n##|$)/);
		if (motivationMatch) {
			const value = motivationMatch[1].trim();
			if (value && !value.startsWith("*")) {
				result.motivation = value;
			}
		}

		// Extract Desired Outcome section
		const outcomeMatch = content.match(/##\s+Desired Outcome\n\n([\s\S]*?)(?=\n##|$)/);
		if (outcomeMatch) {
			const value = outcomeMatch[1].trim();
			if (value && !value.startsWith("*")) {
				result.outcome = value;
			}
		}

		return result;
	}
}

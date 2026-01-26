import type { App, TFile } from "obsidian";
import { ValidationError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import type { ISolutionService } from "../solutions/types";
import { generateUUID } from "../utils/helpers";
import type { UUID } from "../utils/types";
import type {
	CreateRequirementInput,
	IRequirementService,
	Requirement,
	RequirementFrontmatter,
	RequirementServiceOptions,
	UpdateRequirementInput,
} from "./types";
import { RequirementFrontmatterSchema } from "./types";

/**
 * Default folder for storing solution files.
 */
const DEFAULT_SOLUTIONS_FOLDER = "Solutions";

/**
 * Subfolder name for requirements within a solution folder.
 */
const REQUIREMENTS_SUBFOLDER = "Requirements";

/**
 * Service for managing requirements within the Flowti plugin.
 * Requirements are stored as markdown files in solution subfolders.
 */
export class RequirementService implements IRequirementService {
	private app: App;
	private eventBus?: IEventBus;
	private solutionsFolder: string;
	private solutionService?: ISolutionService;

	constructor(options: RequirementServiceOptions) {
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
	 * Create a new requirement within a solution.
	 */
	async create(input: CreateRequirementInput): Promise<Requirement> {
		const title = input.title.trim();
		if (!title) {
			throw new ValidationError({
				code: "INVALID_REQUIREMENT_TITLE",
				message: "Requirement title cannot be empty",
				severity: "medium",
				context: "RequirementService.create",
			});
		}

		// Verify solution exists
		const solutionName = await this.resolveSolutionName(input.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution with ID "${input.solutionId}" not found`,
				severity: "medium",
				context: "RequirementService.create",
			});
		}

		const now = new Date().toISOString();
		const requirement: Requirement = {
			id: generateUUID(),
			title,
			description: input.description,
			priority: input.priority ?? "Medium",
			status: "Proposed",
			solutionId: input.solutionId,
			acceptanceCriteria: input.acceptanceCriteria,
			linkedIdeas: input.linkedIdeas,
			createdAt: now,
			updatedAt: now,
		};

		await this.ensureRequirementsFolder(solutionName);
		await this.createRequirementFile(requirement, solutionName);

		await this.eventBus?.emit("requirement.created", { requirement });

		return requirement;
	}

	/**
	 * Load a requirement by its UUID.
	 */
	async load(id: string): Promise<Requirement | null> {
		const allRequirements = await this.listAll();
		const requirement = allRequirements.find((r) => r.id === id);

		if (requirement) {
			await this.eventBus?.emit("requirement.loaded", { requirement });
		}

		return requirement ?? null;
	}

	/**
	 * List all requirements for a specific solution.
	 */
	async listBySolution(solutionId: string): Promise<Requirement[]> {
		const solutionName = await this.resolveSolutionName(solutionId);
		if (!solutionName) {
			return [];
		}

		const requirementsFolder = this.getRequirementsFolderPath(solutionName);
		const files = await this.getRequirementFiles(requirementsFolder);
		const requirements: Requirement[] = [];

		for (const file of files) {
			const requirement = await this.parseRequirementFile(file);
			if (requirement && requirement.solutionId === solutionId) {
				requirements.push(requirement);
			}
		}

		return requirements.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * List all requirements across all solutions.
	 */
	async listAll(): Promise<Requirement[]> {
		const requirements: Requirement[] = [];
		const solutionFolders = await this.getSolutionFolders();

		for (const folderName of solutionFolders) {
			const requirementsFolder = this.getRequirementsFolderPath(folderName);
			const files = await this.getRequirementFiles(requirementsFolder);

			for (const file of files) {
				const requirement = await this.parseRequirementFile(file);
				if (requirement) {
					requirements.push(requirement);
				}
			}
		}

		return requirements.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * Update a requirement.
	 */
	async update(id: string, updates: UpdateRequirementInput): Promise<Requirement> {
		const requirement = await this.load(id);
		if (!requirement) {
			throw new ValidationError({
				code: "REQUIREMENT_NOT_FOUND",
				message: `Requirement with ID "${id}" not found`,
				severity: "medium",
				context: "RequirementService.update",
			});
		}

		const solutionName = await this.resolveSolutionName(requirement.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for requirement not found`,
				severity: "medium",
				context: "RequirementService.update",
			});
		}

		const updatedRequirement: Requirement = {
			...requirement,
			title: updates.title?.trim() ?? requirement.title,
			description: updates.description ?? requirement.description,
			priority: updates.priority ?? requirement.priority,
			status: updates.status ?? requirement.status,
			acceptanceCriteria: updates.acceptanceCriteria ?? requirement.acceptanceCriteria,
			linkedIdeas: updates.linkedIdeas ?? requirement.linkedIdeas,
			updatedAt: new Date().toISOString(),
		};

		// If title changed, rename the file
		if (updates.title && updates.title.trim() !== requirement.title) {
			await this.renameRequirementFile(
				requirement.title,
				updatedRequirement.title,
				solutionName
			);
		}

		await this.updateRequirementFile(updatedRequirement, solutionName);
		await this.eventBus?.emit("requirement.updated", { requirement: updatedRequirement });

		return updatedRequirement;
	}

	/**
	 * Delete a requirement.
	 */
	async delete(id: string): Promise<void> {
		const requirement = await this.load(id);
		if (!requirement) {
			throw new ValidationError({
				code: "REQUIREMENT_NOT_FOUND",
				message: `Requirement with ID "${id}" not found`,
				severity: "medium",
				context: "RequirementService.delete",
			});
		}

		const solutionName = await this.resolveSolutionName(requirement.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for requirement not found`,
				severity: "medium",
				context: "RequirementService.delete",
			});
		}

		const filePath = this.getRequirementFilePath(requirement.title, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file) {
			await this.app.vault.delete(file as TFile);
		}

		await this.eventBus?.emit("requirement.deleted", {
			requirementId: id,
			solutionId: requirement.solutionId,
		});
	}

	/**
	 * Get requirements linked to a specific idea.
	 * Useful for traceability queries.
	 */
	async getByLinkedIdea(ideaId: string): Promise<Requirement[]> {
		const allRequirements = await this.listAll();
		return allRequirements.filter(
			(req) => req.linkedIdeas?.includes(ideaId as UUID)
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
			if (
				file.path.startsWith(this.solutionsFolder + "/") &&
				!file.path.includes(`/${REQUIREMENTS_SUBFOLDER}/`)
			) {
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
					if (!parts[0].endsWith(".md")) {
						folders.push(parts[0]);
					}
				}
			}
		}

		// Also consider flat structure: Solutions/Name.md -> Name
		const markdownFiles = this.app.vault.getMarkdownFiles();
		for (const file of markdownFiles) {
			if (
				file.path.startsWith(this.solutionsFolder + "/") &&
				file.path.split("/").length === 2
			) {
				const baseName = file.basename;
				if (!folders.includes(baseName)) {
					folders.push(baseName);
				}
			}
		}

		return folders;
	}

	/**
	 * Get the Requirements folder path for a solution.
	 */
	private getRequirementsFolderPath(solutionName: string): string {
		return `${this.solutionsFolder}/${solutionName}/${REQUIREMENTS_SUBFOLDER}`;
	}

	/**
	 * Get the file path for a requirement.
	 */
	private getRequirementFilePath(title: string, solutionName: string): string {
		const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, "-");
		return `${this.getRequirementsFolderPath(solutionName)}/${sanitizedTitle}.md`;
	}

	/**
	 * Ensure the Requirements folder exists for a solution.
	 */
	private async ensureRequirementsFolder(solutionName: string): Promise<void> {
		const solutionFolderPath = `${this.solutionsFolder}/${solutionName}`;
		const requirementsFolderPath = this.getRequirementsFolderPath(solutionName);

		// Ensure solution folder exists
		const solutionFolder = this.app.vault.getAbstractFileByPath(solutionFolderPath);
		if (!solutionFolder) {
			await this.app.vault.createFolder(solutionFolderPath);
		}

		// Ensure requirements subfolder exists
		const requirementsFolder = this.app.vault.getAbstractFileByPath(requirementsFolderPath);
		if (!requirementsFolder) {
			await this.app.vault.createFolder(requirementsFolderPath);
		}
	}

	/**
	 * Get all requirement markdown files in a folder.
	 */
	private async getRequirementFiles(folderPath: string): Promise<TFile[]> {
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
	 * Create a markdown file for a requirement.
	 */
	private async createRequirementFile(
		requirement: Requirement,
		solutionName: string
	): Promise<void> {
		const filePath = this.getRequirementFilePath(requirement.title, solutionName);
		const content = this.generateFileContent(requirement);
		await this.app.vault.create(filePath, content);
	}

	/**
	 * Update a requirement's markdown file.
	 */
	private async updateRequirementFile(
		requirement: Requirement,
		solutionName: string
	): Promise<void> {
		const filePath = this.getRequirementFilePath(requirement.title, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file) {
			throw new ValidationError({
				code: "REQUIREMENT_FILE_NOT_FOUND",
				message: `Requirement file not found: ${filePath}`,
				severity: "medium",
				context: "RequirementService.updateRequirementFile",
			});
		}

		const content = this.generateFileContent(requirement);
		await this.app.vault.modify(file as TFile, content);
	}

	/**
	 * Rename a requirement file.
	 */
	private async renameRequirementFile(
		oldTitle: string,
		newTitle: string,
		solutionName: string
	): Promise<void> {
		const oldPath = this.getRequirementFilePath(oldTitle, solutionName);
		const newPath = this.getRequirementFilePath(newTitle, solutionName);

		const file = this.app.vault.getAbstractFileByPath(oldPath);
		if (file) {
			await this.app.fileManager.renameFile(file as TFile, newPath);
		}
	}

	/**
	 * Generate markdown content for a requirement.
	 */
	private generateFileContent(requirement: Requirement): string {
		const frontmatter: RequirementFrontmatter = {
			id: requirement.id,
			priority: requirement.priority,
			status: requirement.status,
			solutionId: requirement.solutionId,
			acceptanceCriteria: requirement.acceptanceCriteria,
			linkedIdeas: requirement.linkedIdeas,
			createdAt: requirement.createdAt,
			updatedAt: requirement.updatedAt,
		};

		const lines: string[] = [
			"---",
			`id: "${frontmatter.id}"`,
			`priority: "${frontmatter.priority}"`,
			`status: "${frontmatter.status}"`,
			`solutionId: "${frontmatter.solutionId}"`,
		];

		// Add acceptance criteria as YAML array
		if (frontmatter.acceptanceCriteria && frontmatter.acceptanceCriteria.length > 0) {
			lines.push("acceptanceCriteria:");
			for (const criterion of frontmatter.acceptanceCriteria) {
				lines.push(`  - "${criterion.replace(/"/g, '\\"')}"`);
			}
		}

		// Add linked ideas as YAML array
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
			`# ${requirement.title}`,
			""
		);

		if (requirement.description) {
			lines.push(requirement.description, "");
		} else {
			lines.push(
				"*Describe this requirement clearly and unambiguously...*",
				""
			);
		}

		lines.push("## Acceptance Criteria", "");

		if (requirement.acceptanceCriteria && requirement.acceptanceCriteria.length > 0) {
			for (const criterion of requirement.acceptanceCriteria) {
				lines.push(`- [ ] ${criterion}`);
			}
		} else {
			lines.push("*Define how this requirement will be verified...*");
		}

		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Parse a requirement from a markdown file.
	 */
	private async parseRequirementFile(file: TFile): Promise<Requirement | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatter = this.parseFrontmatterWithArrays(content);

			if (!frontmatter) {
				return null;
			}

			const result = RequirementFrontmatterSchema.safeParse(frontmatter);
			if (!result.success) {
				return null;
			}

			const title = this.extractTitle(content, file.basename);
			const description = this.extractDescription(content);

			return {
				id: result.data.id,
				title,
				description,
				priority: result.data.priority,
				status: result.data.status,
				solutionId: result.data.solutionId,
				acceptanceCriteria: result.data.acceptanceCriteria,
				linkedIdeas: result.data.linkedIdeas,
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
		let currentArrayKey: string | null = null;
		let currentArray: string[] = [];

		for (const line of yamlContent.split("\n")) {
			// Check if this is an array item
			if (line.match(/^\s+-\s+/)) {
				let value = line.replace(/^\s+-\s+/, "").trim();
				// Remove quotes if present
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				currentArray.push(value);
				continue;
			}

			// If we were building an array, save it
			if (currentArrayKey && currentArray.length > 0) {
				frontmatter[currentArrayKey] = currentArray;
				currentArrayKey = null;
				currentArray = [];
			}

			const colonIndex = line.indexOf(":");
			if (colonIndex > 0) {
				const key = line.slice(0, colonIndex).trim();
				let value = line.slice(colonIndex + 1).trim();

				// Check if this starts an array
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

				frontmatter[key] = value;
			}
		}

		// Don't forget the last array
		if (currentArrayKey && currentArray.length > 0) {
			frontmatter[currentArrayKey] = currentArray;
		}

		return frontmatter;
	}

	/**
	 * Parse simple frontmatter (for solution lookup).
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
			if (colonIndex > 0 && !line.match(/^\s+-/)) {
				const key = line.slice(0, colonIndex).trim();
				let value = line.slice(colonIndex + 1).trim();

				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}

				if (value) {
					frontmatter[key] = value;
				}
			}
		}

		return frontmatter;
	}

	/**
	 * Extract the requirement title from H1 heading or fallback to filename.
	 */
	private extractTitle(content: string, fallback: string): string {
		const match = content.match(/^#\s+(.+)$/m);
		return match ? match[1].trim() : fallback;
	}

	/**
	 * Extract description from content after heading.
	 */
	private extractDescription(content: string): string | undefined {
		// Find content after the first H1, before "## Acceptance Criteria" or any other H2
		const match = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##|$)/m);
		if (match) {
			const desc = match[1].trim();
			if (desc && !desc.startsWith("*")) {
				return desc;
			}
		}
		return undefined;
	}
}

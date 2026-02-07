import type { App, TFile } from "obsidian";
import { ValidationError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import type { ISolutionService } from "../solutions/types";
import { generateUUID } from "../utils/helpers";
import type {
	CreateIdeaInput,
	Idea,
	IdeaFrontmatter,
	IdeaServiceOptions,
	IIdeaService,
	UpdateIdeaInput,
} from "./types";
import { IdeaFrontmatterSchema } from "./types";

/**
 * Default folder for storing solution files.
 */
const DEFAULT_SOLUTIONS_FOLDER = "Solutions";

/**
 * Subfolder name for ideas within a solution folder.
 */
const IDEAS_SUBFOLDER = "Ideas";

/**
 * Service for managing ideas within the Flowti plugin.
 * Ideas are stored as markdown files in solution subfolders.
 */
export class IdeaService implements IIdeaService {
	private app: App;
	private eventBus?: IEventBus;
	private solutionsFolder: string;
	private solutionService?: ISolutionService;

	constructor(options: IdeaServiceOptions) {
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
	 * Create a new idea within a solution.
	 */
	async create(input: CreateIdeaInput): Promise<Idea> {
		const title = input.title.trim();
		if (!title) {
			throw new ValidationError({
				code: "INVALID_IDEA_TITLE",
				message: "Idea title cannot be empty",
				severity: "medium",
				context: "IdeaService.create",
			});
		}

		// Verify solution exists
		const solutionName = await this.resolveSolutionName(input.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution with ID "${input.solutionId}" not found`,
				severity: "medium",
				context: "IdeaService.create",
			});
		}

		const now = new Date().toISOString();
		const idea: Idea = {
			id: generateUUID(),
			title,
			description: input.description,
			status: "Active",
			solutionId: input.solutionId,
			sourcePhase: input.sourcePhase,
			createdAt: now,
			updatedAt: now,
		};

		await this.ensureIdeasFolder(solutionName);
		await this.createIdeaFile(idea, solutionName);

		await this.eventBus?.emit("idea.created", { idea });

		return idea;
	}

	/**
	 * Load an idea by its UUID.
	 */
	async load(id: string): Promise<Idea | null> {
		const allIdeas = await this.listAll();
		const idea = allIdeas.find((i) => i.id === id);

		if (idea) {
			await this.eventBus?.emit("idea.loaded", { idea });
		}

		return idea ?? null;
	}

	/**
	 * List all ideas for a specific solution.
	 */
	async listBySolution(solutionId: string): Promise<Idea[]> {
		const solutionName = await this.resolveSolutionName(solutionId);
		if (!solutionName) {
			return [];
		}

		const ideasFolder = this.getIdeasFolderPath(solutionName);
		const files = await this.getIdeaFiles(ideasFolder);
		const ideas: Idea[] = [];

		for (const file of files) {
			const idea = await this.parseIdeaFile(file);
			if (idea && idea.solutionId === solutionId) {
				ideas.push(idea);
			}
		}

		return ideas.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * List all ideas across all solutions.
	 */
	async listAll(): Promise<Idea[]> {
		const ideas: Idea[] = [];
		const solutionFolders = await this.getSolutionFolders();

		for (const folderName of solutionFolders) {
			const ideasFolder = this.getIdeasFolderPath(folderName);
			const files = await this.getIdeaFiles(ideasFolder);

			for (const file of files) {
				const idea = await this.parseIdeaFile(file);
				if (idea) {
					ideas.push(idea);
				}
			}
		}

		return ideas.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * Update an idea.
	 */
	async update(id: string, updates: UpdateIdeaInput): Promise<Idea> {
		const idea = await this.load(id);
		if (!idea) {
			throw new ValidationError({
				code: "IDEA_NOT_FOUND",
				message: `Idea with ID "${id}" not found`,
				severity: "medium",
				context: "IdeaService.update",
			});
		}

		const solutionName = await this.resolveSolutionName(idea.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for idea not found`,
				severity: "medium",
				context: "IdeaService.update",
			});
		}

		const updatedIdea: Idea = {
			...idea,
			title: updates.title?.trim() ?? idea.title,
			description: updates.description ?? idea.description,
			status: updates.status ?? idea.status,
			updatedAt: new Date().toISOString(),
		};

		// If title changed, rename the file
		if (updates.title && updates.title.trim() !== idea.title) {
			await this.renameIdeaFile(idea.title, updatedIdea.title, solutionName);
		}

		await this.updateIdeaFile(updatedIdea, solutionName);
		await this.eventBus?.emit("idea.updated", { idea: updatedIdea });

		return updatedIdea;
	}

	/**
	 * Delete an idea.
	 */
	async delete(id: string): Promise<void> {
		const idea = await this.load(id);
		if (!idea) {
			throw new ValidationError({
				code: "IDEA_NOT_FOUND",
				message: `Idea with ID "${id}" not found`,
				severity: "medium",
				context: "IdeaService.delete",
			});
		}

		const solutionName = await this.resolveSolutionName(idea.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for idea not found`,
				severity: "medium",
				context: "IdeaService.delete",
			});
		}

		const filePath = this.getIdeaFilePath(idea.title, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file) {
			await this.app.vault.delete(file as TFile);
		}

		await this.eventBus?.emit("idea.deleted", {
			ideaId: id,
			solutionId: idea.solutionId,
		});
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
			if (file.path.startsWith(this.solutionsFolder + "/") && !file.path.includes(`/${IDEAS_SUBFOLDER}/`)) {
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
	 * Get the Ideas folder path for a solution.
	 */
	private getIdeasFolderPath(solutionName: string): string {
		return `${this.solutionsFolder}/${solutionName}/${IDEAS_SUBFOLDER}`;
	}

	/**
	 * Get the file path for an idea.
	 */
	private getIdeaFilePath(title: string, solutionName: string): string {
		const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, "-");
		return `${this.getIdeasFolderPath(solutionName)}/${sanitizedTitle}.md`;
	}

	/**
	 * Ensure the Ideas folder exists for a solution.
	 */
	private async ensureIdeasFolder(solutionName: string): Promise<void> {
		const solutionFolderPath = `${this.solutionsFolder}/${solutionName}`;
		const ideasFolderPath = this.getIdeasFolderPath(solutionName);

		// Ensure solution folder exists
		const solutionFolder = this.app.vault.getAbstractFileByPath(solutionFolderPath);
		if (!solutionFolder) {
			await this.app.vault.createFolder(solutionFolderPath);
		}

		// Ensure ideas subfolder exists
		const ideasFolder = this.app.vault.getAbstractFileByPath(ideasFolderPath);
		if (!ideasFolder) {
			await this.app.vault.createFolder(ideasFolderPath);
		}
	}

	/**
	 * Get all idea markdown files in a folder.
	 */
	private async getIdeaFiles(folderPath: string): Promise<TFile[]> {
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
	 * Create a markdown file for an idea.
	 */
	private async createIdeaFile(idea: Idea, solutionName: string): Promise<void> {
		const filePath = this.getIdeaFilePath(idea.title, solutionName);
		const content = this.generateFileContent(idea);
		await this.app.vault.create(filePath, content);
	}

	/**
	 * Update an idea's markdown file.
	 */
	private async updateIdeaFile(idea: Idea, solutionName: string): Promise<void> {
		const filePath = this.getIdeaFilePath(idea.title, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file) {
			throw new ValidationError({
				code: "IDEA_FILE_NOT_FOUND",
				message: `Idea file not found: ${filePath}`,
				severity: "medium",
				context: "IdeaService.updateIdeaFile",
			});
		}

		const content = this.generateFileContent(idea);
		await this.app.vault.modify(file as TFile, content);
	}

	/**
	 * Rename an idea file.
	 */
	private async renameIdeaFile(
		oldTitle: string,
		newTitle: string,
		solutionName: string
	): Promise<void> {
		const oldPath = this.getIdeaFilePath(oldTitle, solutionName);
		const newPath = this.getIdeaFilePath(newTitle, solutionName);

		const file = this.app.vault.getAbstractFileByPath(oldPath);
		if (file) {
			await this.app.fileManager.renameFile(file as TFile, newPath);
		}
	}

	/**
	 * Generate markdown content for an idea.
	 */
	private generateFileContent(idea: Idea): string {
		const frontmatter: IdeaFrontmatter = {
			id: idea.id,
			status: idea.status,
			solutionId: idea.solutionId,
			sourcePhase: idea.sourcePhase,
			createdAt: idea.createdAt,
			updatedAt: idea.updatedAt,
		};

		const lines: string[] = [
			"---",
			`id: "${frontmatter.id}"`,
			`status: "${frontmatter.status}"`,
			`solutionId: "${frontmatter.solutionId}"`,
		];

		if (frontmatter.sourcePhase) {
			lines.push(`sourcePhase: "${frontmatter.sourcePhase}"`);
		}

		lines.push(
			`createdAt: "${frontmatter.createdAt}"`,
			`updatedAt: "${frontmatter.updatedAt}"`,
			"---",
			"",
			`# ${idea.title}`,
			""
		);

		if (idea.description) {
			lines.push(idea.description, "");
		} else {
			lines.push("*Describe this idea in more detail...*", "");
		}

		return lines.join("\n");
	}

	/**
	 * Parse an idea from a markdown file.
	 */
	private async parseIdeaFile(file: TFile): Promise<Idea | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatter = this.parseFrontmatter(content);

			if (!frontmatter) {
				return null;
			}

			const result = IdeaFrontmatterSchema.safeParse(frontmatter);
			if (!result.success) {
				return null;
			}

			const title = this.extractTitle(content, file.basename);
			const description = this.extractDescription(content);

			return {
				id: result.data.id,
				title,
				description,
				status: result.data.status,
				solutionId: result.data.solutionId,
				sourcePhase: result.data.sourcePhase,
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
	 * Extract the idea title from H1 heading or fallback to filename.
	 */
	private extractTitle(content: string, fallback: string): string {
		const match = content.match(/^#\s+(.+)$/m);
		return match ? match[1].trim() : fallback;
	}

	/**
	 * Extract description from content after heading.
	 */
	private extractDescription(content: string): string | undefined {
		// Find content after the first heading, before any other heading
		const match = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##|\n#|$)/m);
		if (match) {
			const desc = match[1].trim();
			if (desc && !desc.startsWith("*")) {
				return desc;
			}
		}
		return undefined;
	}
}

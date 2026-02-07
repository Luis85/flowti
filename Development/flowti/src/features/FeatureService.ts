import type { App, TFile } from "obsidian";
import { ValidationError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import type { ISolutionService } from "../solutions/types";
import { generateUUID } from "../utils/helpers";
import type { UUID } from "../utils/types";
import type {
	CreateFeatureInput,
	Feature,
	FeatureFrontmatter,
	FeatureServiceOptions,
	IFeatureService,
	UpdateFeatureInput,
} from "./types";
import { FeatureFrontmatterSchema } from "./types";

/**
 * Default folder for storing solution files.
 */
const DEFAULT_SOLUTIONS_FOLDER = "Solutions";

/**
 * Subfolder name for features within a solution folder.
 */
const FEATURES_SUBFOLDER = "Features";

/**
 * Service for managing features within the Flowti plugin.
 * Features are stored as markdown files in solution subfolders.
 */
export class FeatureService implements IFeatureService {
	private app: App;
	private eventBus?: IEventBus;
	private solutionsFolder: string;
	private solutionService?: ISolutionService;

	constructor(options: FeatureServiceOptions) {
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
	 * Create a new feature within a solution.
	 */
	async create(input: CreateFeatureInput): Promise<Feature> {
		const title = input.title.trim();
		if (!title) {
			throw new ValidationError({
				code: "INVALID_FEATURE_TITLE",
				message: "Feature title cannot be empty",
				severity: "medium",
				context: "FeatureService.create",
			});
		}

		// Verify solution exists
		const solutionName = await this.resolveSolutionName(input.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution with ID "${input.solutionId}" not found`,
				severity: "medium",
				context: "FeatureService.create",
			});
		}

		const now = new Date().toISOString();
		const feature: Feature = {
			id: generateUUID(),
			title,
			description: input.description,
			status: "Draft",
			solutionId: input.solutionId,
			priority: input.priority,
			linkedIdeas: input.linkedIdeas,
			linkedRequirements: input.linkedRequirements,
			createdAt: now,
			updatedAt: now,
		};

		await this.ensureFeaturesFolder(solutionName);
		await this.createFeatureFile(feature, solutionName);

		await this.eventBus?.emit("feature.created", { feature });

		return feature;
	}

	/**
	 * Load a feature by its UUID.
	 */
	async load(id: string): Promise<Feature | null> {
		const allFeatures = await this.listAll();
		const feature = allFeatures.find((f) => f.id === id);

		if (feature) {
			await this.eventBus?.emit("feature.loaded", { feature });
		}

		return feature ?? null;
	}

	/**
	 * List all features for a specific solution.
	 */
	async listBySolution(solutionId: string): Promise<Feature[]> {
		const solutionName = await this.resolveSolutionName(solutionId);
		if (!solutionName) {
			return [];
		}

		const featuresFolder = this.getFeaturesFolderPath(solutionName);
		const files = await this.getFeatureFiles(featuresFolder);
		const features: Feature[] = [];

		for (const file of files) {
			const feature = await this.parseFeatureFile(file);
			if (feature && feature.solutionId === solutionId) {
				features.push(feature);
			}
		}

		return features.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * List all features across all solutions.
	 */
	async listAll(): Promise<Feature[]> {
		const features: Feature[] = [];
		const solutionFolders = await this.getSolutionFolders();

		for (const folderName of solutionFolders) {
			const featuresFolder = this.getFeaturesFolderPath(folderName);
			const files = await this.getFeatureFiles(featuresFolder);

			for (const file of files) {
				const feature = await this.parseFeatureFile(file);
				if (feature) {
					features.push(feature);
				}
			}
		}

		return features.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	/**
	 * Update a feature.
	 */
	async update(id: string, updates: UpdateFeatureInput): Promise<Feature> {
		const feature = await this.load(id);
		if (!feature) {
			throw new ValidationError({
				code: "FEATURE_NOT_FOUND",
				message: `Feature with ID "${id}" not found`,
				severity: "medium",
				context: "FeatureService.update",
			});
		}

		const solutionName = await this.resolveSolutionName(feature.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for feature not found`,
				severity: "medium",
				context: "FeatureService.update",
			});
		}

		const updatedFeature: Feature = {
			...feature,
			title: updates.title?.trim() ?? feature.title,
			description: updates.description ?? feature.description,
			status: updates.status ?? feature.status,
			priority: updates.priority ?? feature.priority,
			linkedIdeas: updates.linkedIdeas ?? feature.linkedIdeas,
			linkedRequirements: updates.linkedRequirements ?? feature.linkedRequirements,
			updatedAt: new Date().toISOString(),
		};

		// If title changed, rename the file
		if (updates.title && updates.title.trim() !== feature.title) {
			await this.renameFeatureFile(
				feature.title,
				updatedFeature.title,
				solutionName
			);
		}

		await this.updateFeatureFile(updatedFeature, solutionName);
		await this.eventBus?.emit("feature.updated", { feature: updatedFeature });

		return updatedFeature;
	}

	/**
	 * Delete a feature.
	 */
	async delete(id: string): Promise<void> {
		const feature = await this.load(id);
		if (!feature) {
			throw new ValidationError({
				code: "FEATURE_NOT_FOUND",
				message: `Feature with ID "${id}" not found`,
				severity: "medium",
				context: "FeatureService.delete",
			});
		}

		const solutionName = await this.resolveSolutionName(feature.solutionId);
		if (!solutionName) {
			throw new ValidationError({
				code: "SOLUTION_NOT_FOUND",
				message: `Solution for feature not found`,
				severity: "medium",
				context: "FeatureService.delete",
			});
		}

		const filePath = this.getFeatureFilePath(feature.title, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file) {
			await this.app.vault.delete(file as TFile);
		}

		await this.eventBus?.emit("feature.deleted", {
			featureId: id,
			solutionId: feature.solutionId,
		});
	}

	/**
	 * Get features linked to a specific idea.
	 * Useful for traceability queries.
	 */
	async getByLinkedIdea(ideaId: string): Promise<Feature[]> {
		const allFeatures = await this.listAll();
		return allFeatures.filter(
			(feature) => feature.linkedIdeas?.includes(ideaId as UUID)
		);
	}

	/**
	 * Get features linked to a specific requirement.
	 * Useful for traceability queries.
	 */
	async getByLinkedRequirement(requirementId: string): Promise<Feature[]> {
		const allFeatures = await this.listAll();
		return allFeatures.filter(
			(feature) => feature.linkedRequirements?.includes(requirementId as UUID)
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
				!file.path.includes(`/${FEATURES_SUBFOLDER}/`)
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
	 * Get the Features folder path for a solution.
	 */
	private getFeaturesFolderPath(solutionName: string): string {
		return `${this.solutionsFolder}/${solutionName}/${FEATURES_SUBFOLDER}`;
	}

	/**
	 * Get the file path for a feature.
	 */
	private getFeatureFilePath(title: string, solutionName: string): string {
		const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, "-");
		return `${this.getFeaturesFolderPath(solutionName)}/${sanitizedTitle}.md`;
	}

	/**
	 * Ensure the Features folder exists for a solution.
	 */
	private async ensureFeaturesFolder(solutionName: string): Promise<void> {
		const solutionFolderPath = `${this.solutionsFolder}/${solutionName}`;
		const featuresFolderPath = this.getFeaturesFolderPath(solutionName);

		// Ensure solution folder exists
		const solutionFolder = this.app.vault.getAbstractFileByPath(solutionFolderPath);
		if (!solutionFolder) {
			await this.app.vault.createFolder(solutionFolderPath);
		}

		// Ensure features subfolder exists
		const featuresFolder = this.app.vault.getAbstractFileByPath(featuresFolderPath);
		if (!featuresFolder) {
			await this.app.vault.createFolder(featuresFolderPath);
		}
	}

	/**
	 * Get all feature markdown files in a folder.
	 */
	private async getFeatureFiles(folderPath: string): Promise<TFile[]> {
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
	 * Create a markdown file for a feature.
	 */
	private async createFeatureFile(
		feature: Feature,
		solutionName: string
	): Promise<void> {
		const filePath = this.getFeatureFilePath(feature.title, solutionName);
		const content = this.generateFileContent(feature);
		await this.app.vault.create(filePath, content);
	}

	/**
	 * Update a feature's markdown file.
	 */
	private async updateFeatureFile(
		feature: Feature,
		solutionName: string
	): Promise<void> {
		const filePath = this.getFeatureFilePath(feature.title, solutionName);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file) {
			throw new ValidationError({
				code: "FEATURE_FILE_NOT_FOUND",
				message: `Feature file not found: ${filePath}`,
				severity: "medium",
				context: "FeatureService.updateFeatureFile",
			});
		}

		const content = this.generateFileContent(feature);
		await this.app.vault.modify(file as TFile, content);
	}

	/**
	 * Rename a feature file.
	 */
	private async renameFeatureFile(
		oldTitle: string,
		newTitle: string,
		solutionName: string
	): Promise<void> {
		const oldPath = this.getFeatureFilePath(oldTitle, solutionName);
		const newPath = this.getFeatureFilePath(newTitle, solutionName);

		const file = this.app.vault.getAbstractFileByPath(oldPath);
		if (file) {
			await this.app.fileManager.renameFile(file as TFile, newPath);
		}
	}

	/**
	 * Generate markdown content for a feature.
	 */
	private generateFileContent(feature: Feature): string {
		const frontmatter: FeatureFrontmatter = {
			id: feature.id,
			status: feature.status,
			solutionId: feature.solutionId,
			priority: feature.priority,
			linkedIdeas: feature.linkedIdeas,
			linkedRequirements: feature.linkedRequirements,
			createdAt: feature.createdAt,
			updatedAt: feature.updatedAt,
		};

		const lines: string[] = [
			"---",
			`id: "${frontmatter.id}"`,
			`status: "${frontmatter.status}"`,
			`solutionId: "${frontmatter.solutionId}"`,
		];

		// Add priority if set
		if (frontmatter.priority) {
			lines.push(`priority: "${frontmatter.priority}"`);
		}

		// Add linked ideas as YAML array
		if (frontmatter.linkedIdeas && frontmatter.linkedIdeas.length > 0) {
			lines.push("linkedIdeas:");
			for (const ideaId of frontmatter.linkedIdeas) {
				lines.push(`  - "${ideaId}"`);
			}
		}

		// Add linked requirements as YAML array
		if (frontmatter.linkedRequirements && frontmatter.linkedRequirements.length > 0) {
			lines.push("linkedRequirements:");
			for (const reqId of frontmatter.linkedRequirements) {
				lines.push(`  - "${reqId}"`);
			}
		}

		lines.push(
			`createdAt: "${frontmatter.createdAt}"`,
			`updatedAt: "${frontmatter.updatedAt}"`,
			"---",
			"",
			`# ${feature.title}`,
			""
		);

		if (feature.description) {
			lines.push(feature.description, "");
		} else {
			lines.push(
				"*Describe this feature and what it enables for users...*",
				""
			);
		}

		lines.push("## Linked Ideas", "");
		if (feature.linkedIdeas && feature.linkedIdeas.length > 0) {
			lines.push("*Ideas that inspired this feature:*");
			for (const ideaId of feature.linkedIdeas) {
				lines.push(`- [[${ideaId}]]`);
			}
		} else {
			lines.push("*No linked ideas yet.*");
		}
		lines.push("");

		lines.push("## Linked Requirements", "");
		if (feature.linkedRequirements && feature.linkedRequirements.length > 0) {
			lines.push("*Requirements needed to implement this feature:*");
			for (const reqId of feature.linkedRequirements) {
				lines.push(`- [[${reqId}]]`);
			}
		} else {
			lines.push("*No linked requirements yet.*");
		}
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Parse a feature from a markdown file.
	 */
	private async parseFeatureFile(file: TFile): Promise<Feature | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatter = this.parseFrontmatterWithArrays(content);

			if (!frontmatter) {
				return null;
			}

			const result = FeatureFrontmatterSchema.safeParse(frontmatter);
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
				priority: result.data.priority,
				linkedIdeas: result.data.linkedIdeas,
				linkedRequirements: result.data.linkedRequirements,
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
	 * Extract the feature title from H1 heading or fallback to filename.
	 */
	private extractTitle(content: string, fallback: string): string {
		const match = content.match(/^#\s+(.+)$/m);
		return match ? match[1].trim() : fallback;
	}

	/**
	 * Extract description from content after heading.
	 */
	private extractDescription(content: string): string | undefined {
		// Find content after the first H1, before "## Linked Ideas" or any other H2
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

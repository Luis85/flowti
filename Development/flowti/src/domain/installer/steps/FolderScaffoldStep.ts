import { DEFAULT_IBDE_FOLDERS } from "../folders";
import type {
	IInstallerStep,
	InstallerContext,
	InstallerStepDeps,
	InstallerStepResult,
} from "../types";

/**
 * Installation step that scaffolds the IBDE folder structure.
 * Creates a `.gitkeep` placeholder in each folder via {@link InstallerStepDeps.fileSystem}.
 * Idempotent: silently skips folders that already exist.
 */
export class FolderScaffoldStep implements IInstallerStep {
	readonly id = "folder-scaffold";
	readonly name = "Create Folder Structure";
	readonly description = "Creates the IBDE folder hierarchy in your vault";
	readonly intro =
		"The IBDE folder structure follows the PARA method (Projects, Areas, Resources, " +
		"Archives) and extends it with Connectivity and Data Storage folders. This gives " +
		"you a ready-made framework for organizing business documentation, data imports, " +
		"and daily operations from day one.";
	readonly order = 20;

	async execute(
		context: InstallerContext,
		deps: InstallerStepDeps,
	): Promise<InstallerStepResult> {
		const createdFolders: string[] = [];

		for (const folder of DEFAULT_IBDE_FOLDERS) {
			const placeholderPath = `${folder}/.gitkeep`;
			try {
				const exists = await deps.fileSystem.fileExists(placeholderPath);
				if (exists) {
					createdFolders.push(folder);
					continue;
				}
				await deps.fileSystem.createFile(placeholderPath, "", {
					createFolders: true,
				});
				createdFolders.push(folder);
			} catch (error) {
				context.createdFolders = createdFolders;
				return {
					status: "failed",
					message: `Failed to create folder: ${folder}`,
					error: error instanceof Error ? error : new Error(String(error)),
				};
			}
		}

		context.createdFolders = createdFolders;
		return {
			status: "completed",
			message: `Created ${createdFolders.length} folders`,
		};
	}
}

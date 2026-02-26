import type {
	IInstallerStep,
	InstallerContext,
	InstallerStepDeps,
	InstallerStepResult,
} from "../types";
import { SEED_CSV_PATH, SUPPLIER_OVERVIEW_CSV, WELCOME_NOTE_PATH } from "../seedData";

/**
 * Installation step that seeds sample supplier data and a welcome note.
 *
 * Order 30 — runs after UserCreationStep (10) and FolderScaffoldStep (20).
 * Idempotent: skips files that already exist.
 */
export class SeedContentStep implements IInstallerStep {
	readonly id = "seed-content";
	readonly name = "Seed Sample Data";
	readonly description = "Creates sample supplier data and a welcome note to get you started";
	readonly intro =
		"Sample data gives you a ready-made supplier overview with realistic " +
		"metrics so you can explore dashboards, queries, and charts immediately. " +
		"The welcome note guides your first steps.";
	readonly order = 30;

	async execute(
		context: InstallerContext,
		deps: InstallerStepDeps,
	): Promise<InstallerStepResult> {
		const seededFiles: string[] = [];
		const filesToSeed = this.getFilesToSeed(context);

		for (const { path, content } of filesToSeed) {
			try {
				const exists = await deps.fileSystem.fileExists(path);
				if (exists) {
					seededFiles.push(path);
					continue;
				}
				await deps.fileSystem.createFile(path, content, {
					createFolders: true,
				});
				seededFiles.push(path);
			} catch (error) {
				context.seededFiles = seededFiles;
				return {
					status: "failed",
					message: `Failed to create seed file: ${path}`,
					error: error instanceof Error ? error : new Error(String(error)),
				};
			}
		}

		context.seededFiles = seededFiles;
		return {
			status: "completed",
			message: `Seeded ${seededFiles.length} files`,
		};
	}

	private getFilesToSeed(context: InstallerContext): Array<{ path: string; content: string }> {
		const userName = context.userName?.trim() ?? "there";
		return [
			{
				path: SEED_CSV_PATH,
				content: SUPPLIER_OVERVIEW_CSV,
			},
			{
				path: WELCOME_NOTE_PATH,
				content: this.getWelcomeNote(userName),
			},
		];
	}

	private getWelcomeNote(userName: string): string {
		return [
			`# Welcome to Flowti, ${userName}!`,
			"",
			"Your Integrated Business Development Environment is ready.",
			"",
			"## First Steps",
			"",
			"1. **Explore your dashboard** — Open the Analytics Hub to see your Supplier Overview dashboard with live charts and metrics.",
			"2. **Review sample data** — The supplier overview CSV in `03 - Resources/Sample Data/` contains realistic demo data you can modify.",
			"3. **Import your own data** — Drop CSV files into `00 - Connectivity/imports/` to trigger the ingestion pipeline.",
			"4. **Create subscriptions** — Set up event subscriptions to watch for file changes in specific folders.",
			"5. **Build custom queries** — Use the Analytics Query Builder to slice and dice your data.",
			"",
			"## Key Concepts",
			"",
			"- **Events** drive everything — file changes emit events, subscriptions react.",
			"- **Dashboards** visualize query results as tables, stat cards, and charts.",
			"- **Sessions** are time-boxed documentation periods for focused work.",
			"",
			"> Tip: Use the command palette (`Ctrl+P`) and search for \"Flowti\" to see all available commands.",
		].join("\n");
	}
}

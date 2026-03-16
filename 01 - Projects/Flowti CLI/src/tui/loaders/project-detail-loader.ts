/**
 * project-detail-loader.ts — Project info loader.
 *
 * Uses the disk abstraction to count source and test files
 * in the current project directory.
 */

import type { LoaderContext } from "./loader-types.js";

export interface ProjectDetailData {
	readonly name: string;
	readonly path: string;
	readonly sourceFiles: number;
	readonly testFiles: number;
}

function countFiles(ctx: LoaderContext, dir: string, extension: string): number {
	const { deps } = ctx;
	try {
		if (!deps.disk.existsSync(dir)) return 0;
		let count = 0;
		const entries = deps.disk.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const entryPath = deps.paths.join(dir, entry.name);
			if (entry.isDirectory()) {
				count += countFiles(ctx, entryPath, extension);
			} else if (entry.name.endsWith(extension)) {
				count += 1;
			}
		}
		return count;
	} catch {
		return 0;
	}
}

export function loadProjectDetail(ctx: LoaderContext): ProjectDetailData {
	const { deps, projectPath, projectsDir, params } = ctx;

	// If a specific project was selected, use that path
	const targetPath = params.project
		? deps.paths.join(projectsDir, params.project)
		: projectPath;

	if (!targetPath) {
		return { name: "", path: "", sourceFiles: 0, testFiles: 0 };
	}

	const name = deps.paths.basename(targetPath);
	const srcDir = deps.paths.join(targetPath, "src");
	const testsDir = deps.paths.join(targetPath, "tests");

	const sourceFiles = countFiles(ctx, srcDir, ".ts");
	const testFiles = countFiles(ctx, testsDir, ".test.ts");

	return { name, path: targetPath, sourceFiles, testFiles };
}

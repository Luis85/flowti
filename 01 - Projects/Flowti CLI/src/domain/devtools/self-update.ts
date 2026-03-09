/**
 * self-update.ts — Pure functions for CLI self-update detection.
 *
 * Compares source file modification times against the compiled binary
 * to determine if a rebuild is needed.
 */

import type { IFileSystem, DirEntry } from "../../infrastructure/types.js";
import type { IShell } from "../../infrastructure/types.js";
import { paths } from "../../infrastructure/paths.js";

// ── Pure functions ───────────────────────────────────────────────────

/**
 * Recursively find the newest mtime (ms since epoch) among files
 * matching the given extension in a directory tree.
 * Returns 0 if no matching files are found.
 */
export function getNewestMtime(dir: string, ext: string, fs: IFileSystem): number {
	let newest = 0;

	let entries: DirEntry[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}

	for (const entry of entries) {
		const fullPath = paths.join(dir, entry.name);
		if (entry.isDirectory()) {
			const sub = getNewestMtime(fullPath, ext, fs);
			if (sub > newest) newest = sub;
		} else if (entry.isFile() && entry.name.endsWith(ext)) {
			const stat = fs.statSync(fullPath);
			const mtime = stat.mtimeMs;
			if (mtime > newest) newest = mtime;
		}
	}

	return newest;
}

/**
 * Check whether any source file is newer than the compiled binary.
 * Returns true if a rebuild is needed.
 */
export function needsRebuild(srcDir: string, binaryPath: string, fs: IFileSystem): boolean {
	if (!fs.existsSync(binaryPath)) return true;

	const binaryStat = fs.statSync(binaryPath);
	const binaryMtime = binaryStat.mtimeMs;
	const newestSource = getNewestMtime(srcDir, ".ts", fs);

	return newestSource > binaryMtime;
}

/**
 * Run `npm run build` in the project directory.
 * Returns the shell exit code.
 */
export function rebuildCli(projectPath: string, shell: IShell): number {
	return shell.run("npm run build", { cwd: projectPath, label: "Rebuilding CLI..." });
}

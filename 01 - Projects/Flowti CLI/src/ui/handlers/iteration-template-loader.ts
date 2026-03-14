/**
 * iteration-template-loader.ts — Loads the iteration lifecycle JSON definition.
 *
 * Reads the JSON file from the project's configs folder and parses it
 * into a LifecycleTemplate using the pure loadTemplate() function.
 */

import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import type { IterationsConfig, IFileSystem, IPaths } from "../../infrastructure/types.js";
import { loadTemplate } from "../../domain/lifecycle/lifecycle-engine.js";

const DEFAULT_LIFECYCLE_FILE = "iteration-lifecycle.json";

export function loadIterationTemplate(
	deps: { disk: IFileSystem; paths: IPaths },
	projectPath: string,
	config?: IterationsConfig,
): LifecycleTemplate | null {
	const filename = config?.lifecycle ?? DEFAULT_LIFECYCLE_FILE;
	const filePath = deps.paths.join(projectPath, "configs", filename);

	if (!deps.disk.existsSync(filePath)) return null;

	try {
		const content = deps.disk.readFileSync(filePath, "utf-8");
		const raw = JSON.parse(content);
		return loadTemplate(raw);
	} catch {
		return null;
	}
}

/**
 * generate-trace-report.ts
 *
 * Pure helper functions for trace report generation.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { parseFrontmatterContent } from "../../../infrastructure/frontmatter.js";

export type ScanDeps = Pick<CliDeps, "disk" | "paths">;

export interface ScanResult {
	id: string;
	type: string;
	frontmatter: Record<string, unknown>;
}

export function scanDir(dir: string, docType: string, deps: ScanDeps): ScanResult[] {
	const results: ScanResult[] = [];
	if (!deps.disk.existsSync(dir)) return results;

	const files: string[] = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	for (const file of files) {
		const content: string = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm: Record<string, unknown> | null = parseFrontmatterContent(content);
		if (!fm) continue;
		results.push({ id: file.replace(/\.md$/, ""), type: docType, frontmatter: fm });
	}
	return results;
}

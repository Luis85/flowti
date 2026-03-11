/**
 * generate-trace-report.ts
 *
 * Pure helper functions for trace report generation.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { parseFrontmatterContent } from "../../../infrastructure/frontmatter.js";

interface ScanResult {
	id: string;
	type: string;
	frontmatter: Record<string, unknown>;
}

export function scanDir(dir: string, docType: string): ScanResult[] {
	const results: ScanResult[] = [];
	if (!disk.existsSync(dir)) return results;

	const files: string[] = disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	for (const file of files) {
		const content: string = disk.readFileSync(paths.join(dir, file), "utf-8");
		const fm: Record<string, unknown> | null = parseFrontmatterContent(content);
		if (!fm) continue;
		results.push({ id: file.replace(/\.md$/, ""), type: docType, frontmatter: fm });
	}
	return results;
}

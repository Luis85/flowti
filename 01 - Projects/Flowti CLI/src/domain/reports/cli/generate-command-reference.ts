/**
 * generate-command-reference.ts — CLI project command reference generator.
 *
 * Reads command metadata from the CommandRegistry source and generates
 * a Command Reference vault note with queryable YAML frontmatter.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Types ────────────────────────────────────────────────────────────

interface CommandMeta {
	id: string;
	label: string;
	description: string;
	domain: string;
	category: string;
	icon?: string;
}

// ── Extraction ───────────────────────────────────────────────────────

/**
 * Extract command metadata from registry.ts source.
 * Parses both createCommandDefinitions() and getExternalCommandMeta().
 */
function extractCommandMeta(source: string): CommandMeta[] {
	const commands: CommandMeta[] = [];

	// Extract from createCommandDefinitions()
	const defRegex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",\s*)?/g;
	let match: RegExpExecArray | null;
	while ((match = defRegex.exec(source)) !== null) {
		commands.push({
			id: match[1],
			label: match[2],
			description: match[3],
			domain: match[4],
			category: match[5],
			icon: match[6] || undefined,
		});
	}

	// Extract from getExternalCommandMeta()
	const metaStart = source.indexOf("getExternalCommandMeta");
	if (metaStart !== -1) {
		const metaRegex =
			/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",?\s*)?/g;
		metaRegex.lastIndex = metaStart;
		while ((match = metaRegex.exec(source)) !== null) {
			if (!commands.some((c) => c.id === match![1])) {
				commands.push({
					id: match[1],
					label: match[2],
					description: match[3],
					domain: match[4],
					category: match[5],
					icon: match[6] || undefined,
				});
			}
		}
	}

	return commands;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Generator ────────────────────────────────────────────────────────

export function generateCommandReference(projectPath: string, deps: ReportDeps, ctx?: PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const registryPath = deps.paths.join(PLUGIN_ROOT, "src", "infrastructure", "commands", "registry.ts");

	if (!deps.disk.existsSync(registryPath)) {
		log("[cli-report] CommandRegistry source not found — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "CommandRegistry source not found" };
	}

	const source: string = deps.disk.readFileSync(registryPath, "utf-8");
	const commands: CommandMeta[] = extractCommandMeta(source);

	if (commands.length === 0) {
		log("[cli-report] No commands extracted from registry — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "No commands extracted from registry" };
	}

	// Group by domain
	const groups: Map<string, CommandMeta[]> = new Map();
	for (const cmd of commands) {
		const existing: CommandMeta[] = groups.get(cmd.domain) ?? [];
		existing.push(cmd);
		groups.set(cmd.domain, existing);
	}
	for (const [, cmds] of groups) {
		cmds.sort((a: CommandMeta, b: CommandMeta) => a.label.localeCompare(b.label));
	}
	const sortedDomains: string[] = Array.from(groups.keys()).sort();

	const fm = {
		type: "CommandReference",
		date: deps.clock.iso(),
		total_commands: commands.length,
		domains: sortedDomains.length,
	};

	const doc = Document.create("Command Reference")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Command Reference")
		.addBlank()
		.callout("info", "Summary", [
			`Total commands: ${fm.total_commands} | Domains: ${fm.domains}`,
		])
		.addBlank();

	for (const domain of sortedDomains) {
		const cmds: CommandMeta[] = groups.get(domain)!;
		doc.heading(2, capitalize(domain)).addBlank();
		doc.table(
			["Command", "Description", "Category", "Icon"],
			cmds.map((cmd: CommandMeta) => [cmd.label, cmd.description, cmd.category, cmd.icon ?? ""]),
		);
		doc.addBlank();
	}

	const outputPath = svc.saveReference(doc, "Command Reference.md");

	log(`[cli-report] Command Reference (${commands.length} commands)`);
	log(`  Domains: ${sortedDomains.length}`);
	log(`  Written: ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: { total_commands: commands.length, domains: sortedDomains.length },
	};
}

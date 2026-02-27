/**
 * commandReferenceGenerator.ts
 *
 * Pure functions to generate a Command Reference document
 * from CommandMeta arrays. Used by build-time scripts.
 */

export interface CommandMetaInput {
	id: string;
	label: string;
	description: string;
	domain: string;
	category: string;
	icon?: string;
	shortcut?: string;
}

export interface CommandReferenceReport {
	type: "CommandReference";
	date: string;
	total_commands: number;
	domains: number;
}

/**
 * Group commands by domain, sorted alphabetically within each group.
 */
export function groupByDomain(
	commands: CommandMetaInput[],
): Map<string, CommandMetaInput[]> {
	const groups = new Map<string, CommandMetaInput[]>();
	for (const cmd of commands) {
		const existing = groups.get(cmd.domain) ?? [];
		existing.push(cmd);
		groups.set(cmd.domain, existing);
	}
	// Sort commands within each group alphabetically by label
	for (const [, cmds] of groups) {
		cmds.sort((a, b) => a.label.localeCompare(b.label));
	}
	return groups;
}

/**
 * Generate the full Command Reference markdown document.
 */
export function generateCommandReference(
	commands: CommandMetaInput[],
	date: string,
): string {
	const groups = groupByDomain(commands);
	const sortedDomains = Array.from(groups.keys()).sort();

	const fm: CommandReferenceReport = {
		type: "CommandReference",
		date,
		total_commands: commands.length,
		domains: sortedDomains.length,
	};

	const lines: string[] = [
		"---",
		`type: ${fm.type}`,
		`date: "${fm.date}"`,
		`total_commands: ${fm.total_commands}`,
		`domains: ${fm.domains}`,
		"---",
		"",
		"# Command Reference",
		"",
		`> [!info] Summary`,
		`> Total commands: ${fm.total_commands} | Domains: ${fm.domains}`,
		"",
	];

	for (const domain of sortedDomains) {
		const cmds = groups.get(domain)!;
		lines.push(`## ${capitalize(domain)}`, "");
		lines.push("| Command | Description | Category | Icon | Shortcut |");
		lines.push("|---------|-------------|----------|------|----------|");
		for (const cmd of cmds) {
			const shortcut = cmd.shortcut ?? "";
			const icon = cmd.icon ?? "";
			lines.push(`| ${cmd.label} | ${cmd.description} | ${cmd.category} | ${icon} | ${shortcut} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * generate-cli-surface-md.ts — Build Markdown documenting the built-in CLI command surface.
 */

import type { CommandRegistry } from "../infrastructure/command-registry.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CommandDescriptor, FlagSpec } from "../infrastructure/command-engine.js";

function getDescriptor(handler: CommandHandler): CommandDescriptor | undefined {
	const d = (handler as { __descriptor?: CommandDescriptor }).__descriptor;
	return d;
}

function formatFlags(flags: Record<string, FlagSpec> | undefined): string {
	if (!flags || Object.keys(flags).length === 0) return "";
	const parts = Object.entries(flags).map(([name, spec]) => {
		const type = spec.type;
		const req = spec.required ? "required" : "optional";
		const def = spec.default !== undefined ? `, default=${JSON.stringify(spec.default)}` : "";
		return `\`${name}\` (${type}, ${req}${def})`;
	});
	return parts.join("; ");
}

function rowForCommand(command: string, handler: CommandHandler, domain: string, projectFree: boolean): string {
	const desc = getDescriptor(handler);
	const requires = desc?.requires === "project" ? "yes" : "no";
	const flagStr = formatFlags(desc?.flags);
	const raw = desc?.rawArgs ? "yes" : "no";
	const wild = desc?.wildcardPrefix ? `\`${desc.wildcardPrefix}*\`` : "—";
	const flagsCol = flagStr || "—";
	return `| \`${command}\` | ${domain} | ${projectFree ? "yes" : "no"} | ${requires} | ${raw} | ${wild} | ${flagsCol} |`;
}

/**
 * Produce Markdown suitable for checking in under docs/ (built-in commands only).
 */
export function generateCliSurfaceMarkdown(registry: CommandRegistry): string {
	const rows = registry.commandRows();
	const sorted = [...rows].sort((a, b) => a.command.localeCompare(b.command));
	const handlerMap = registry.handlers;

	const tableLines = sorted.map((r) =>
		rowForCommand(r.command, handlerMap[r.command]!, r.domain, r.projectFree),
	);

	const wildcardNote =
		registry.wildcard && registry.wildcardPrefix
			? `Wildcard: commands matching \`${registry.wildcardPrefix}*\` are handled by domain **${registry.wildcardDomainName ?? "reports"}** (e.g. \`report:my-id\`).\n`
			: "";

	const domainLines = registry
		.domains()
		.sort()
		.map((d) => `- **${d}**`);

	const lines: string[] = [
		"# Flowti CLI — command surface (built-in)",
		"",
		"**Generated** — regenerate with `flowti docs:cli-surface` (or `node .flowti/bin/main.mjs docs:cli-surface`).",
		"",
		"## Plugin / Obsidian entry",
		"",
		"The Flowti Obsidian plugin and other tooling should invoke the bundled CLI as:",
		"",
		"```text",
		"node <vault>/.flowti/bin/main.mjs <command> [flags...]",
		"```",
		"",
		"- Global flags: `--verbose`, `--quiet`, `--no-color`, `--project=<name>`, `--format=json` (where supported).",
		"- `agent:start` is a special case: it opens a JSONL stdin/stdout loop and does not exit until the session ends.",
		"- **No interactive TUI** — the CLI is command-only; empty invocation exits with usage and a non-zero code.",
		"",
		"Plugin-provided commands are registered at runtime when a project is loaded; they are **not** listed below.",
		"",
		"## Capabilities (domains)",
		"",
		...domainLines,
		"",
		"## Commands",
		"",
		wildcardNote,
		"| Command | Domain | Project-free | Requires project | rawArgs | Wildcard prefix | Flags |",
		"|---------|--------|--------------|------------------|---------|-----------------|-------|",
		...tableLines,
		"",
	];

	return lines.join("\n");
}

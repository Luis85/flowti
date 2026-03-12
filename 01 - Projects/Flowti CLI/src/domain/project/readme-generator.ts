/**
 * readme-generator.ts — Generate a README.md for a Flowti Project.
 *
 * Reads the project's config and package.json to produce a standardized
 * README with project brief, wikilinks, and tool availability.
 * Called on demand via `flowti readme`.
 */

import type { ProjectContext } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import { detectTools } from "./tool-availability.js";

export type ReadmeDeps = Pick<CliDeps, "disk" | "paths">;

function renderBrief(name: string): string[] {
	return [
		"## Project Brief",
		"",
		`> See [[${name} — Architecture]] for the technical design.`,
		"",
		"### Vision",
		"",
		"_What problem does this project solve? Who is it for?_",
		"",
		"### Goals",
		"",
		"- [ ] Goal 1",
		"- [ ] Goal 2",
		"- [ ] Goal 3",
		"",
		"### Non-Goals",
		"",
		"- _What is explicitly out of scope?_",
		"",
	];
}

function renderCommands(scripts: Record<string, string>): string[] {
	if (Object.keys(scripts).length === 0) return [];
	const lines = ["## Commands", "", "| Command | Script |", "|---------|--------|"];
	for (const [scriptName, cmd] of Object.entries(scripts)) {
		lines.push(`| \`npm run ${scriptName}\` | \`${cmd}\` |`);
	}
	lines.push("");
	return lines;
}

function renderCommandMap(title: string, commands: Record<string, string> | undefined): string[] {
	if (!commands || Object.keys(commands).length === 0) return [];
	const lines = [`## ${title}`, ""];
	for (const [key, cmd] of Object.entries(commands)) {
		lines.push(`- **${key}**: \`${cmd}\``);
	}
	lines.push("");
	return lines;
}

function renderTools(projectPath: string, deps: ReadmeDeps): string[] {
	const available = detectTools(projectPath, deps).filter((t) => t.available);
	if (available.length === 0) return [];
	const lines = ["## Dev Tools", ""];
	for (const tool of available) {
		lines.push(`- ${tool.id} ${tool.version ?? ""}`);
	}
	lines.push("");
	return lines;
}

function renderLinks(name: string): string[] {
	return [
		"## Documentation",
		"",
		`- [[${name} — Architecture]] — Technical architecture (arc42 + C4)`,
		`- [[configs/flowti.config.json]] — CLI configuration`,
		`- [[configs/tsconfig.json]] — TypeScript configuration`,
		"",
		"---",
		"",
		"*Managed by [Flowti CLI](https://github.com/flowti/flowti-cli)*",
		"",
	];
}

export function generateReadme(ctx: ProjectContext, deps: ReadmeDeps): string {
	const name = ctx.config.name;
	const generators = ctx.config.reports?.generators ?? [];
	const reportLines = generators.length > 0
		? ["## Reports", "", ...generators.map((g) => `- ${g.label}`), ""]
		: [];

	return [
		`# ${name}`,
		"",
		...renderBrief(name),
		...renderCommands(ctx.scripts),
		...renderCommandMap("Build Modes", ctx.config.build?.commands),
		...renderCommandMap("Test Presets", ctx.config.test?.commands),
		...reportLines,
		...renderTools(ctx.path, deps),
		...renderLinks(name),
	].join("\n");
}

/**
 * Write or overwrite the project's README.md.
 * Returns the absolute path to the written file.
 */
export function writeReadme(ctx: ProjectContext, deps: ReadmeDeps): string {
	const content = generateReadme(ctx, deps);
	const readmePath = deps.paths.join(ctx.path, "README.md");
	deps.disk.writeFileSync(readmePath, content, "utf-8");
	return readmePath;
}

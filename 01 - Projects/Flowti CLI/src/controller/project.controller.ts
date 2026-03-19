/**
 * project.controller.ts — Controller for project selection command.
 *
 * listProjects and getProjectPath are in domain/project/project.ts (pure).
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { renderInteractiveOnly, renderSuccess, type InteractiveOnlyModel, type SuccessModel } from "../ui/renderers/common-renderers.js";
import { writeReadme } from "../domain/project/readme-generator.js";
import { detectProject, type DetectionResult } from "../domain/project/project-detect.js";
import { buildBootstrapConfig } from "../domain/project/project-bootstrap.js";
import { PROJECTS_DIR } from "../infrastructure/config.js";

function createSketchpad(name: string, briefVaultPath: string): string {
	const canvas = {
		nodes: [{
			id: "brief",
			type: "file",
			x: 0,
			y: 0,
			width: 500,
			height: 400,
			file: briefVaultPath,
		}],
		edges: [],
	};
	return JSON.stringify(canvas, null, "\t") + "\n";
}

export const commands: Record<string, CommandHandler> = {
	project: adaptDescriptor<Record<string, unknown>, InteractiveOnlyModel>({
		handler: (_ctx) => ({
			command: "project",
			error: "Project selection is interactive. Run \"flowti\" without arguments to use the interactive menu.",
		}),
		renderer: renderInteractiveOnly,
	}),

	readme: adaptDescriptor<Record<string, unknown>, SuccessModel>({
		requires: "project",
		handler: (ctx) => {
			const readmePath = writeReadme(ctx.project!, ctx.deps);
			return { message: `README.md written to ${readmePath}` };
		},
		renderer: renderSuccess,
	}),

	"project:create": adaptDescriptor<{ name: string }, { created: boolean; path: string }>({
		flags: { name: { type: "string", required: true, hint: "--name=<value>" } },
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const projectDir = paths.join(PROJECTS_DIR, ctx.flags.name);
			const configDir = paths.join(projectDir, "configs");
			disk.mkdirSync(configDir, { recursive: true });
			const configPath = paths.join(configDir, "flowti.config.json");
			const minimalConfig = { build: { commands: {} }, test: { commands: {} }, devtools: { lint: { maxComplexity: 10, maxLines: 350 } } };
			disk.writeFileSync(configPath, JSON.stringify(minimalConfig, null, "\t") + "\n", "utf8");
			const briefPath = paths.join(projectDir, `${ctx.flags.name}.md`);
			disk.writeFileSync(briefPath, `---\ntype: ProjectBrief\n---\n\n# ${ctx.flags.name}\n\nProject brief.\n`, "utf8");
			const briefVaultPath = `01 - Projects/${ctx.flags.name}/${ctx.flags.name}.md`;
			const sketchpadPath = paths.join(projectDir, `${ctx.flags.name} - Sketchpad.canvas`);
			disk.writeFileSync(sketchpadPath, createSketchpad(ctx.flags.name, briefVaultPath), "utf8");
			return { created: true, path: projectDir };
		},
		renderer: (data: { created: boolean; path: string }, log: LogFn) => {
			log(`  Project created at ${data.path}`);
		},
	}),

	"project:detect": adaptDescriptor<Record<string, unknown>, DetectionResult>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const detectDeps = {
				disk: {
					existsSync: (p: string) => disk.existsSync(p),
					readFileSync: (p: string) => disk.readFileSync(p, "utf8"),
				},
				paths: { join: (...s: string[]) => paths.join(...s) },
			};
			return detectProject(ctx.project!.path, detectDeps);
		},
		renderer: (data: DetectionResult, log: LogFn) => {
			log(`  Type: ${data.type}`);
			if (data.framework) log(`  Framework: ${data.framework}`);
			if (data.packageManager) log(`  Package Manager: ${data.packageManager}`);
			if (data.testFramework) log(`  Test Framework: ${data.testFramework}`);
			log(`  Has Config: ${data.hasConfig}`);
		},
	}),

	"project:bootstrap": adaptDescriptor<{ project: string; build: string; test: string; lint: string; storybook: string }, { path: string }>({
		requires: "project",
		flags: {
			build: { type: "string", default: "", hint: "--build=<cmd>" },
			test: { type: "string", default: "", hint: "--test=<cmd>" },
			lint: { type: "string", default: "", hint: "--lint=<cmd>" },
			storybook: { type: "string", default: "", hint: "--storybook=<framework>" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const config = buildBootstrapConfig({
				build: ctx.flags.build || undefined,
				test: ctx.flags.test || undefined,
				lint: ctx.flags.lint || undefined,
				storybook: ctx.flags.storybook || undefined,
			});
			const configDir = paths.join(ctx.project!.path, "configs");
			if (!disk.existsSync(configDir)) {
				disk.mkdirSync(configDir, { recursive: true });
			}
			const configPath = paths.join(configDir, "flowti.config.json");
			disk.writeFileSync(configPath, JSON.stringify(config, null, "\t") + "\n", "utf8");
			const projectName = paths.basename(ctx.project!.path);
			const briefPath = paths.join(ctx.project!.path, `${projectName}.md`);
			if (!disk.existsSync(briefPath)) {
				disk.writeFileSync(briefPath, `---\ntype: ProjectBrief\n---\n\n# ${projectName}\n\nProject brief.\n`, "utf8");
			}
			const sketchpadPath = paths.join(ctx.project!.path, `${projectName} - Sketchpad.canvas`);
			if (!disk.existsSync(sketchpadPath)) {
				const briefVaultPath = `01 - Projects/${projectName}/${projectName}.md`;
				disk.writeFileSync(sketchpadPath, createSketchpad(projectName, briefVaultPath), "utf8");
			}
			return { path: configPath };
		},
		renderer: (data: { path: string }, log: LogFn) => {
			log(`  Config written to ${data.path}`);
		},
	}),
};

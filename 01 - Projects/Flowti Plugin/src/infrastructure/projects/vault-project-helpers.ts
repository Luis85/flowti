/**
 * Helper functions for vault-project-service — extracted to reduce
 * complexity and line count of the main service class.
 */

import { TFile } from "obsidian";
import type { App } from "obsidian";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { AgentBlueprint, ProjectConfig, StorybookStatus, TeamRoleSlot } from "../../domain/projects/types.js";
import { parseProjectRoleMarkdown, projectRoleNoteRelativePath } from "../../domain/projects/project-role-markdown.js";

const PROJECT_BRIEF_TYPE = "ProjectBrief";

function parseNoteType(content: string): string | null {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return null;
	const typeMatch = match[1].match(/^type:\s*(.+)$/m);
	return typeMatch ? typeMatch[1].trim() : null;
}

/** Read note type + hasNote flag from vault or disk fallback. */
export function resolveNoteInfo(
	app: App,
	notePath: string,
	basePath: string,
): { hasNote: boolean; type: string } {
	const noteFile = app.vault.getAbstractFileByPath(notePath);

	if (noteFile instanceof TFile) {
		// Synchronous read not available — handled by caller
		return { hasNote: false, type: "unknown" };
	}

	const absNotePath = join(basePath, notePath);
	if (existsSync(absNotePath)) {
		try {
			const content = readFileSync(absNotePath, "utf-8");
			const noteType = parseNoteType(content);
			return {
				hasNote: noteType === PROJECT_BRIEF_TYPE,
				type: noteType ?? "unknown",
			};
		} catch { /* can't read */ }
	}
	return { hasNote: false, type: "unknown" };
}

/** Async variant that reads via vault API when file is indexed. */
export async function resolveNoteInfoAsync(
	app: App,
	notePath: string,
	basePath: string,
): Promise<{ hasNote: boolean; type: string }> {
	const noteFile = app.vault.getAbstractFileByPath(notePath);

	if (noteFile instanceof TFile) {
		const content = await app.vault.cachedRead(noteFile);
		const noteType = parseNoteType(content);
		return {
			hasNote: noteType === PROJECT_BRIEF_TYPE,
			type: noteType ?? "unknown",
		};
	}

	return resolveNoteInfo(app, notePath, basePath);
}

/** Read brief data from frontmatter cache. */
export function readBrief(
	app: App,
	noteFile: TFile,
): import("../../domain/projects/types.js").ProjectBrief | undefined {
	const cache = app.metadataCache.getFileCache(noteFile);
	const fm = cache?.frontmatter;
	if (!fm) return undefined;
	return {
		start: fm.start != null ? String(fm.start) : undefined,
		end: fm.end != null ? String(fm.end) : undefined,
		goal: fm.goal != null ? String(fm.goal) : undefined,
		description: fm.description != null ? String(fm.description) : undefined,
		status: fm.status != null ? String(fm.status) : undefined,
	};
}

/** Merge running process info into storybook status. */
export function mergeRunningStatus(
	storybook: StorybookStatus,
	running: { pid: number; url: string } | undefined,
): StorybookStatus {
	if (!running) return storybook;
	return { ...storybook, running: true, url: running.url, pid: running.pid };
}

/** Read type from flowti.config.json if not already known. */
export function readTypeFromConfig(absPath: string, currentType: string): string {
	if (currentType !== "unknown") return currentType;
	try {
		const configPath = join(absPath, "configs", "flowti.config.json");
		if (existsSync(configPath)) {
			const config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
			if (config.type) return String(config.type);
		}
	} catch { /* invalid config */ }
	return currentType;
}

/** Parse project config from flowti.config.json. */
export function parseProjectConfig(
	absPath: string,
): { config?: ProjectConfig; type?: string; framework?: string } {
	try {
		const configPath = join(absPath, "configs", "flowti.config.json");
		if (!existsSync(configPath)) return {};
		const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;

		const type = raw.type ? String(raw.type) : undefined;
		const components = (raw.components ?? {}) as Record<string, unknown>;
		const framework = components.framework ? String(components.framework) : undefined;

		const config: ProjectConfig = {
			buildModes: Object.keys(((raw.build as Record<string, unknown>)?.commands ?? {}) as Record<string, unknown>),
			testPresets: Object.keys(((raw.test as Record<string, unknown>)?.commands ?? {}) as Record<string, unknown>),
			framework,
			healthTargets: parseHealthTargets(raw),
			agents: parseAgentRoster(raw),
			roleSlots: parseRoleSlots(raw),
			publishTargets: parsePublishTargets(raw),
			markdownSource: parseMarkdownSource(components),
		};

		return { config, type, framework };
	} catch { return {}; }
}

function parseHealthTargets(raw: Record<string, unknown>): ProjectConfig["healthTargets"] {
	const healthRaw = (raw.health as Record<string, unknown>)?.thresholds as Record<string, unknown> | undefined;
	const coverage = healthRaw?.coverage as Record<string, unknown> | undefined;
	const lint = healthRaw?.lint as Record<string, unknown> | undefined;
	const tests = healthRaw?.tests as Record<string, unknown> | undefined;
	if (!coverage && !lint && !tests) return undefined;
	return {
		coverageMin: coverage?.min as number | undefined,
		coverageTarget: coverage?.target as number | undefined,
		maxLintErrors: lint?.maxErrors as number | undefined,
		maxLintWarnings: lint?.maxWarnings as number | undefined,
		minTests: tests?.minPassed as number | undefined,
	};
}

function parseAgentRoster(raw: Record<string, unknown>): string[] | undefined {
	const mgmt = raw.management as Record<string, unknown> | undefined;
	return (mgmt?.agents as Record<string, unknown>)?.roster as string[] | undefined;
}

function parseRoleSlots(raw: Record<string, unknown>): TeamRoleSlot[] | undefined {
	const mgmt = raw.management as Record<string, unknown> | undefined;
	const agents = mgmt?.agents as Record<string, unknown> | undefined;
	const slots = agents?.roleSlots as unknown[] | undefined;
	if (!Array.isArray(slots) || slots.length === 0) return undefined;
	const out: TeamRoleSlot[] = [];
	for (const s of slots) {
		if (!s || typeof s !== "object") continue;
		const o = s as Record<string, unknown>;
		const id = typeof o.id === "string" ? o.id : "";
		const title = typeof o.title === "string" ? o.title : "";
		const need = typeof o.need === "string" ? o.need : "";
		const roleNotePath = typeof o.roleNotePath === "string" && o.roleNotePath.trim() ? o.roleNotePath.trim() : undefined;
		if (!id || (!title.trim() && !roleNotePath)) continue;
		const assignee = typeof o.assignee === "string" && o.assignee.trim() ? o.assignee.trim() : undefined;
		const blueprint = parseBlueprintField(o.blueprint);
		const slot: TeamRoleSlot = { id, title: title.trim() || id, need, ...(roleNotePath && { roleNotePath }), ...(assignee && { assignee }), ...(blueprint && { blueprint }) };
		out.push(slot);
	}
	return out.length > 0 ? out : undefined;
}

/** Merge `team/roles/*.md` content into slots for UI (skills, body, title from `role:`). */
export function enrichRoleSlotsWithRoleNotes(
	vaultBasePath: string,
	projectFolderName: string,
	slots: readonly TeamRoleSlot[] | undefined,
): TeamRoleSlot[] | undefined {
	if (!slots?.length) return slots ? [...slots] : undefined;
	return slots.map((s) => {
		const path = s.roleNotePath ?? projectRoleNoteRelativePath(projectFolderName, s.id);
		const abs = join(vaultBasePath, path);
		if (!existsSync(abs)) {
			return s.roleNotePath ? s : { ...s, roleNotePath: path };
		}
		try {
			const parsed = parseProjectRoleMarkdown(readFileSync(abs, "utf-8"));
			if (!parsed) return { ...s, roleNotePath: path };
			return {
				...s,
				title: parsed.role || s.title,
				need: parsed.need || s.need,
				roleNotePath: path,
				roleSkills: parsed.skills.length > 0 ? parsed.skills : s.roleSkills,
				roleSummary: parsed.summary || s.roleSummary,
				roleBody: parsed.body || s.roleBody,
				roleFte: parsed.fte ?? s.roleFte,
				roleStart: parsed.start ?? s.roleStart,
				roleEnd: parsed.end ?? s.roleEnd,
			};
		} catch {
			return { ...s, roleNotePath: path };
		}
	});
}

/** Apply markdown enrichment to project config in memory (for `getProject`). */
export function enrichProjectConfigRoleSlots(
	vaultBasePath: string,
	projectAbsPath: string,
	config: ProjectConfig | undefined,
): ProjectConfig | undefined {
	if (!config?.roleSlots?.length) return config;
	const folder = basename(projectAbsPath);
	const roleSlots = enrichRoleSlotsWithRoleNotes(vaultBasePath, folder, config.roleSlots);
	if (!roleSlots) return config;
	return { ...config, roleSlots };
}

function parseBlueprintField(raw: unknown): AgentBlueprint | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const b = raw as Record<string, unknown>;
	const goalsRaw = b.goals as unknown[] | undefined;
	const goals = Array.isArray(goalsRaw)
		? goalsRaw
			.filter((g): g is { name: string; priority?: number } => !!g && typeof g === "object" && typeof (g as { name?: string }).name === "string")
			.map((g) => ({ name: g.name, ...(typeof g.priority === "number" ? { priority: g.priority } : {}) }))
		: undefined;
	const attrs = b.attributes as Record<string, unknown> | undefined;
	const attributes = attrs && typeof attrs === "object"
		? {
			...(typeof attrs.str === "number" ? { str: attrs.str } : {}),
			...(typeof attrs.int === "number" ? { int: attrs.int } : {}),
			...(typeof attrs.wis === "number" ? { wis: attrs.wis } : {}),
			...(typeof attrs.cha === "number" ? { cha: attrs.cha } : {}),
			...(typeof attrs.dex === "number" ? { dex: attrs.dex } : {}),
			...(typeof attrs.con === "number" ? { con: attrs.con } : {}),
		}
		: undefined;
	const blueprint: AgentBlueprint = {
		...(typeof b.agentType === "string" ? { agentType: b.agentType } : {}),
		...(typeof b.domain === "string" ? { domain: b.domain } : {}),
		...(typeof b.persona === "string" ? { persona: b.persona } : {}),
		...(typeof b.mood === "string" ? { mood: b.mood } : {}),
		...(typeof b.description === "string" ? { description: b.description } : {}),
		...(Array.isArray(b.personality) ? { personality: (b.personality as unknown[]).filter((x): x is string => typeof x === "string") } : {}),
		...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {}),
		...(Array.isArray(b.skills) ? { skills: (b.skills as unknown[]).filter((x): x is string => typeof x === "string") } : {}),
		...(Array.isArray(b.behaviors) ? { behaviors: (b.behaviors as unknown[]).filter((x): x is string => typeof x === "string") } : {}),
		...(Array.isArray(b.suggestedTasks) ? { suggestedTasks: (b.suggestedTasks as unknown[]).filter((x): x is string => typeof x === "string") } : {}),
		...(goals && goals.length > 0 ? { goals } : {}),
	};
	return Object.keys(blueprint).length > 0 ? blueprint : undefined;
}

function parsePublishTargets(raw: Record<string, unknown>): string[] | undefined {
	const endpoints = (raw.publish as Record<string, unknown>)?.endpoints as Array<Record<string, unknown>> | undefined;
	return endpoints?.map((e) => String(e.name));
}

function parseMarkdownSource(components: Record<string, unknown>): ProjectConfig["markdownSource"] {
	if (!components.markdownSource) return undefined;
	const ms = components.markdownSource as Record<string, unknown>;
	return {
		path: String(ms.path ?? ""),
		strategy: String(ms.strategy ?? "category") as import("../../domain/projects/types.js").ImportStrategy,
		requiredFields: (ms.requiredFields as string[] | undefined) ?? [],
	};
}

/** Check sitemap-related file presence. */
export function checkSitemapFiles(
	absProjectPath: string,
): { hasSitemap: boolean; hasCanvas: boolean; canvasChanged: boolean } {
	const hasSitemap = existsSync(join(absProjectPath, "configs", "sitemap.json"))
		|| existsSync(join(absProjectPath, "imported-sitemap.json"));

	const canvasPath = join(absProjectPath, "sitemap.canvas");
	const hasCanvas = existsSync(canvasPath);
	let canvasChanged = false;

	if (hasCanvas) {
		const metaPath = join(absProjectPath, "configs", ".sitemap-canvas-meta.json");
		if (existsSync(metaPath)) {
			try {
				const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { canvasHash?: string };
				// eslint-disable-next-line @typescript-eslint/no-require-imports -- sync crypto needed for hash comparison
				const crypto = require("node:crypto");
				const currentHash = crypto.createHash("md5").update(readFileSync(canvasPath, "utf-8")).digest("hex");
				canvasChanged = meta.canvasHash !== currentHash;
			} catch { canvasChanged = true; }
		} else {
			canvasChanged = true;
		}
	}

	return { hasSitemap, hasCanvas, canvasChanged };
}

/** Detect project type, framework, package manager, etc. from package.json and file presence. */
export function detectProjectFromDisk(projectPath: string): {
	type: string;
	framework?: string;
	packageManager?: string;
	testFramework?: string;
	hasConfig: boolean;
	buildCommand?: string;
	testCommand?: string;
	lintCommand?: string;
} {
	const hasPkg = existsSync(join(projectPath, "package.json"));
	const hasTsConfig = existsSync(join(projectPath, "tsconfig.json"));
	const type = !hasPkg ? "unknown" : hasTsConfig ? "typescript" : "javascript";

	let pkg: Record<string, unknown> = {};
	if (hasPkg) {
		try { pkg = JSON.parse(readFileSync(join(projectPath, "package.json"), "utf-8")) as Record<string, unknown>; } catch { /* empty */ }
	}
	const allDeps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
	const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
	const scripts = (pkg.scripts ?? {}) as Record<string, string>;

	const framework = detectFramework(projectPath, allDeps);
	const packageManager = detectPackageManager(projectPath);
	const testFramework = detectTestFramework(devDeps);
	const hasConfig = existsSync(join(projectPath, "configs", "flowti.config.json"))
		|| existsSync(join(projectPath, "flowti.config.json"));
	const pm = packageManager ?? "npm";

	return {
		type, framework, packageManager, testFramework, hasConfig,
		buildCommand: scripts.build ? `${pm} run build` : undefined,
		testCommand: scripts.test ? `${pm} test` : undefined,
		lintCommand: scripts.lint ? `${pm} run lint` : undefined,
	};
}

function detectFramework(
	projectPath: string,
	allDeps: Record<string, string>,
): string | undefined {
	if (existsSync(join(projectPath, "angular.json"))) return "Angular";
	if (existsSync(join(projectPath, "next.config.js")) || existsSync(join(projectPath, "next.config.ts"))) return "Next.js";
	if ("react" in allDeps && ("vite" in allDeps || existsSync(join(projectPath, "vite.config.ts")))) return "React";
	if ("vue" in allDeps) return "Vue";
	if ("svelte" in allDeps) return "Svelte";
	return undefined;
}

function detectPackageManager(projectPath: string): string | undefined {
	if (existsSync(join(projectPath, "bun.lockb"))) return "bun";
	if (existsSync(join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(projectPath, "yarn.lock"))) return "yarn";
	if (existsSync(join(projectPath, "package-lock.json"))) return "npm";
	return undefined;
}

function detectTestFramework(devDeps: Record<string, string>): string | undefined {
	if ("vitest" in devDeps) return "vitest";
	if ("jest" in devDeps) return "jest";
	return undefined;
}

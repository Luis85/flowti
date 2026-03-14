/**
 * project-config.ts — Per-project configuration service.
 *
 * Detects package.json in the selected project, auto-creates a
 * flowti.config.json if missing, and provides project-scoped
 * data (npm scripts, mapped actions) to the detail menu.
 */

import type { ProjectConfig, ProjectContext } from "../../infrastructure/types.js";
import { validateProjectConfig } from "./config-schema.js";
import { validateConfigDeep } from "./config-deep-validation.js";
import type { CliDeps } from "../../infrastructure/deps.js";

const CONFIGS_DIR = "configs";
const FLOWTI_CONFIG = "flowti.config.json";

// ── Path resolution ─────────────────────────────────────────────────

export function resolveProjectPath(name: string, projectsDir: string, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(projectsDir, name);
}

// ── Package.json ────────────────────────────────────────────────────

export interface PackageJson {
	name?: string;
	version?: string;
	scripts?: Record<string, string>;
}

export function readPackageJson(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): PackageJson | null {
	const pkgPath = deps.paths.join(projectPath, "package.json");
	if (!deps.disk.existsSync(pkgPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(pkgPath, "utf-8")) as PackageJson;
	} catch {
		return null;
	}
}

// ── Flowti project config ───────────────────────────────────────────

export interface ReadConfigResult {
	config: ProjectConfig | null;
	warnings: string[];
}

export function readProjectConfig(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): ReadConfigResult {
	const cfgPath = deps.paths.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	if (!deps.disk.existsSync(cfgPath)) return { config: null, warnings: [] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(deps.disk.readFileSync(cfgPath, "utf-8"));
	} catch {
		return { config: null, warnings: [] };
	}

	const { errors, warnings } = validateProjectConfig(parsed);

	if (errors.length > 0) {
		return { config: null, warnings: [...errors, ...warnings] };
	}

	return { config: parsed as ProjectConfig, warnings };
}

/** Update the project's flowti.config.json by applying a mutation function. Returns true on success. */
export function updateProjectConfig(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">, mutate: (config: ProjectConfig) => void): boolean {
	const cfgPath = deps.paths.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	if (!deps.disk.existsSync(cfgPath)) return false;
	let parsed: unknown;
	try {
		parsed = JSON.parse(deps.disk.readFileSync(cfgPath, "utf-8"));
	} catch {
		return false;
	}
	if (!parsed || typeof parsed !== "object") return false;
	mutate(parsed as ProjectConfig);
	deps.disk.writeFileSync(cfgPath, JSON.stringify(parsed, null, "\t"), "utf-8");
	return true;
}

function mapBuildScripts(scripts: Record<string, string>): Record<string, string> {
	const build: Record<string, string> = {};
	if (scripts["build"]) build.fast = "npm run build";
	if (scripts["build:watch"] || scripts["build:dev"]) build.watch = scripts["build:watch"] ? "npm run build:watch" : "npm run build:dev";
	return build;
}

function mapTestScripts(scripts: Record<string, string>): Record<string, string> {
	const test: Record<string, string> = {};
	if (scripts["test"]) test.unit = "npm test";
	if (scripts["test:e2e"]) test.e2e = "npm run test:e2e";
	return test;
}

function mapDevtoolScripts(scripts: Record<string, string>): Record<string, string> {
	const devtools: Record<string, string> = {};
	if (scripts["lint"]) devtools.lint = "npm run lint";
	if (scripts["check"]) devtools.check = "npm run check";
	return devtools;
}

function withNonEmpty(key: string, commands: Record<string, string>): Record<string, unknown> {
	return Object.keys(commands).length > 0 ? { [key]: { commands } } : {};
}

function scaffoldProjectConfig(projectPath: string, pkg: PackageJson, deps: Pick<CliDeps, "disk" | "paths">): ProjectConfig {
	const scripts = pkg.scripts ?? {};

	const config: ProjectConfig = {
		name: pkg.name ?? deps.paths.basename(projectPath),
		...withNonEmpty("build", mapBuildScripts(scripts)),
		...withNonEmpty("test", mapTestScripts(scripts)),
		...withNonEmpty("devtools", mapDevtoolScripts(scripts)),
	};

	const configsDir = deps.paths.join(projectPath, CONFIGS_DIR);
	if (!deps.disk.existsSync(configsDir)) deps.disk.mkdirSync(configsDir, { recursive: true });
	const cfgPath = deps.paths.join(configsDir, FLOWTI_CONFIG);
	deps.disk.writeFileSync(cfgPath, JSON.stringify(config, null, "\t"), "utf-8");
	return config;
}

// ── Initialize project ──────────────────────────────────────────────

export function initializeProject(name: string, projectsDir: string, deps: Pick<CliDeps, "disk" | "paths">): ProjectContext {
	const projectPath = resolveProjectPath(name, projectsDir, deps);
	const pkg = readPackageJson(projectPath, deps);

	const { config: loadedConfig, warnings } = readProjectConfig(projectPath, deps);
	let config = loadedConfig;

	if (!config && pkg) {
		config = scaffoldProjectConfig(projectPath, pkg, deps);
	}

	if (!config) {
		config = { name };
	}

	// Deep validation: check configured paths exist on disk
	const deep = validateConfigDeep(config, projectPath, deps.disk, deps.paths);
	const allWarnings = [...warnings, ...deep.warnings];

	return {
		path: projectPath,
		pkg,
		config,
		scripts: pkg?.scripts ?? {},
		configWarnings: allWarnings.length > 0 ? allWarnings : undefined,
	};
}

// ── Reports directory ────────────────────────────────────────────────

const DEFAULT_REPORTS_DIR = "reports";

export function getReportsDir(projectPath: string, config: ProjectConfig, deps: Pick<CliDeps, "paths">): string {
	return deps.paths.join(projectPath, config.reports?.dir ?? DEFAULT_REPORTS_DIR);
}

export function getReportsOutputDir(projectPath: string, config: ProjectConfig, deps: Pick<CliDeps, "paths">): string {
	const outputDir = config.reports?.outputDir;
	if (outputDir) return deps.paths.join(projectPath, outputDir);
	return deps.paths.join(projectPath, config.reports?.dir ?? DEFAULT_REPORTS_DIR);
}

/**
 * project-detect.ts — Pure domain: scan a project directory and detect its type.
 *
 * Detects: language type, framework, package manager, test framework, existing config.
 * No I/O — all file access via injected deps.
 */

export interface DetectionResult {
	readonly type: "typescript" | "javascript" | "unknown";
	readonly framework: string | undefined;
	readonly packageManager: "npm" | "yarn" | "pnpm" | "bun" | undefined;
	readonly testFramework: string | undefined;
	readonly hasConfig: boolean;
	readonly buildCommand: string | undefined;
	readonly testCommand: string | undefined;
	readonly lintCommand: string | undefined;
}

interface DetectDeps {
	readonly disk: {
		existsSync(path: string): boolean;
		readFileSync(path: string): string;
	};
	readonly paths: {
		join(...segments: string[]): string;
	};
}

export function detectProject(projectPath: string, deps: DetectDeps): DetectionResult {
	const { disk, paths } = deps;

	const exists = (rel: string) => disk.existsSync(paths.join(projectPath, rel));
	const readJson = (rel: string): Record<string, unknown> => {
		try {
			return JSON.parse(disk.readFileSync(paths.join(projectPath, rel))) as Record<string, unknown>;
		} catch { return {}; }
	};

	const hasPkg = exists("package.json");
	const hasTsConfig = exists("tsconfig.json");
	const type = !hasPkg ? "unknown" : hasTsConfig ? "typescript" : "javascript";

	const pkg = hasPkg ? readJson("package.json") : {};
	const allDeps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
	const framework = detectFramework(allDeps, exists);

	const packageManager = exists("bun.lockb") ? "bun" as const
		: exists("pnpm-lock.yaml") ? "pnpm" as const
		: exists("yarn.lock") ? "yarn" as const
		: exists("package-lock.json") ? "npm" as const
		: undefined;

	const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
	const testFramework = "vitest" in devDeps ? "vitest"
		: "jest" in devDeps ? "jest"
		: "mocha" in devDeps ? "mocha"
		: "playwright" in devDeps || "@playwright/test" in devDeps ? "playwright"
		: "cypress" in devDeps ? "cypress"
		: undefined;

	const hasConfig = exists("flowti.config.json") || exists("configs/flowti.config.json");

	const scripts = (pkg.scripts ?? {}) as Record<string, string>;
	const pm = packageManager ?? "npm";
	const buildCommand = scripts.build ? `${pm} run build` : undefined;
	const testCommand = scripts.test ? `${pm} test` : undefined;
	const lintCommand = scripts.lint ? `${pm} run lint` : undefined;

	return { type, framework, packageManager, testFramework, hasConfig, buildCommand, testCommand, lintCommand };
}

function detectFramework(deps: Record<string, string>, exists: (rel: string) => boolean): string | undefined {
	if (exists("angular.json")) return "Angular";
	if (exists("next.config.js") || exists("next.config.ts") || exists("next.config.mjs")) return "Next.js";
	if (exists("nuxt.config.js") || exists("nuxt.config.ts")) return "Nuxt";
	if (("react" in deps || "react-dom" in deps) && ("vite" in deps || exists("vite.config.ts") || exists("vite.config.js"))) return "React";
	if ("vue" in deps) return "Vue";
	if ("svelte" in deps) return "Svelte";
	if ("react" in deps || "react-dom" in deps) return "React";
	return undefined;
}

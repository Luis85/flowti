/**
 * storybook-service.ts — Storybook lifecycle management for projects.
 *
 * Handles installation, detection, background launching, and vault-aware
 * browser opening for the opt-in Storybook component library.
 *
 * Display concerns delegated to StorybookRenderer (injected).
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { VAULT_ROOT } from "../../../infrastructure/config.js";
import { isCliAvailable, isVaultInitialized } from "../../knowledgebase/vault-service.js";
import type { ComponentsConfig, ComponentFramework, BackgroundProcess } from "../../../infrastructure/types.js";
import type { StorybookRenderer } from "./storybook-renderer.js";
import { nullStorybookRenderer } from "./storybook-renderer.js";

export type StorybookDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "input">;

const DEFAULT_STORYBOOK_DIR = "components";
const DEFAULT_STORYBOOK_PORT = 6006;
const READY_PATTERN = /Storybook ready/;
const LOCAL_URL_PATTERN = /https?:\/\/localhost:\d+/;
const READY_TIMEOUT_MS = 120_000;

// ── Detection ────────────────────────────────────────────────────────

export function resolveStorybookDir(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "paths">): string {
	return deps.paths.resolve(projectPath, config.storybookDir ?? DEFAULT_STORYBOOK_DIR);
}

export function isStorybookInstalled(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "disk" | "paths">): boolean {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	return deps.disk.existsSync(deps.paths.join(sbDir, "package.json"));
}

// ── Framework-specific packages ──────────────────────────────────────

interface FrameworkPackages {
	/** The Storybook framework package (used as devDependency AND config import). */
	framework: string;
	/** Additional devDependencies needed for this framework. */
	extra?: Record<string, string>;
}

/**
 * Returns framework-specific package info for Storybook 10.
 *
 * In Storybook 10 the `-vite` framework packages serve as both
 * framework and renderer, and addons like `addon-interactions` and
 * `@storybook/test` are built into the core `storybook` package.
 */
export function getFrameworkPackages(framework: ComponentFramework): FrameworkPackages {
	switch (framework) {
		case "angular":
			return {
				framework: "@storybook/angular",
				extra: {
					"@angular/cli": "^21.0.0",
					"@angular/core": "^21.0.0",
					"@angular/common": "^21.0.0",
					"@angular/compiler": "^21.0.0",
					"@angular/compiler-cli": "^21.0.0",
					"@angular/platform-browser": "^21.0.0",
					"@angular/platform-browser-dynamic": "^21.0.0",
					"@angular-devkit/build-angular": "^21.0.0",
					"typescript": "^5.8.0",
					"zone.js": "^0.15.0",
				},
			};
		case "react":
			return {
				framework: "@storybook/react-vite",
				extra: { "react": "^19.0.0", "react-dom": "^19.0.0", "@types/react": "^19.0.0" },
			};
		case "vue":
			return {
				framework: "@storybook/vue3-vite",
				extra: { "vue": "^3.5.0" },
			};
		case "html":
		default:
			return {
				framework: "@storybook/html-vite",
			};
	}
}

// ── Installation ─────────────────────────────────────────────────────

/** Writes a minimal package.json for non-Angular frameworks so storybook init has a project to detect. */
function writePackageJson(sbDir: string, projectName: string, framework: ComponentFramework, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const fw = getFrameworkPackages(framework);
	const pkg = {
		name: `${projectName}-components`,
		version: "1.0.0",
		private: true,
		type: "module",
		devDependencies: {
			[fw.framework]: "^10.0.0",
			...fw.extra,
		},
	};
	deps.disk.writeFileSync(deps.paths.join(sbDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
}

/**
 * Writes a minimal Angular workspace (angular.json + tsconfig.json) before Storybook init.
 * Only includes the `build` target — Storybook init adds its own storybook/build-storybook targets.
 */
function writeAngularWorkspace(sbDir: string, _projectName: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const angularJson = {
		$schema: "./node_modules/@angular/cli/lib/config/schema.json",
		version: 1,
		newProjectRoot: "projects",
		projects: {
			components: {
				projectType: "library",
				root: "",
				sourceRoot: ".",
				architect: {
					build: {
						builder: "@angular-devkit/build-angular:application",
						options: {
							tsConfig: "tsconfig.json",
							outputPath: "dist",
						},
					},
				},
			},
		},
	};
	deps.disk.writeFileSync(deps.paths.join(sbDir, "angular.json"), JSON.stringify(angularJson, null, 2), "utf-8");

	const tsconfig = {
		compilerOptions: {
			target: "ES2022",
			module: "ES2022",
			moduleResolution: "bundler",
			lib: ["ES2022", "dom"],
			declaration: true,
			declarationMap: true,
			sourceMap: true,
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			experimentalDecorators: true,
			emitDecoratorMetadata: true,
			outDir: "./dist",
			baseUrl: ".",
		},
		include: ["./**/*.ts"],
		exclude: ["node_modules", "dist"],
	};
	deps.disk.writeFileSync(deps.paths.join(sbDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2), "utf-8");
}

/** Writes a minimal package.json with Angular deps so Storybook init can detect the framework. */
function writeAngularWorkspacePackageJson(sbDir: string, projectName: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const fw = getFrameworkPackages("angular");
	const pkg = {
		name: `${projectName}-components`,
		version: "1.0.0",
		private: true,
		devDependencies: { ...fw.extra },
	};
	deps.disk.writeFileSync(deps.paths.join(sbDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
}

/** After Storybook init, patch main.ts to disable telemetry and fix stories glob. */
function patchStorybookConfig(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const mainPath = deps.paths.join(sbDir, ".storybook", "main.ts");
	try {
		let content = deps.disk.readFileSync(mainPath, "utf-8");
		// Fix stories glob: point to all component directories, not just a stories folder
		content = content.replace(/\.\.\/stories\//g, "../");
		// Disable telemetry if not already present
		if (!content.includes("disableTelemetry")) {
			content = content.replace(
				/("framework":\s*"[^"]+?")\s*\n(\s*\};)/,
				'$1,\n  "core": {\n    "disableTelemetry": true\n  }\n$2',
			);
		}
		deps.disk.writeFileSync(mainPath, content, "utf-8");
	} catch { /* leave as-is if file doesn't exist */ }
}

/** After Storybook init, fix .storybook/tsconfig.json paths for our component layout. */
function patchStorybookTsconfig(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const tsconfigPath = deps.paths.join(sbDir, ".storybook", "tsconfig.json");
	try {
		let content = deps.disk.readFileSync(tsconfigPath, "utf-8");
		// Fix extends: tsconfig.lib.json doesn't exist, use tsconfig.json
		content = content.replace(/tsconfig\.lib\.json/g, "tsconfig.json");
		// Fix include paths: components live at root, not in src/
		content = content.replace(/\.\.\/src\//g, "../");
		deps.disk.writeFileSync(tsconfigPath, content, "utf-8");
	} catch { /* leave as-is if file doesn't exist */ }
}

/** Remove the example stories folder created by storybook init. */
function removeExampleStories(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const storiesDir = deps.paths.join(sbDir, "stories");
	try {
		if (deps.disk.existsSync(storiesDir)) {
			deps.disk.rmSync(storiesDir, { recursive: true, force: true });
		}
	} catch { /* ignore if removal fails */ }
}

/** After Storybook init, patch Angular-specific files: scripts, compodoc, vitest addon. */
function patchAngularProject(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	// Patch package.json scripts to use ng run
	const pkgPath = deps.paths.join(sbDir, "package.json");
	try {
		const pkg = JSON.parse(deps.disk.readFileSync(pkgPath, "utf-8"));
		pkg.scripts = {
			...pkg.scripts,
			storybook: "ng run components:storybook",
			"build-storybook": "ng run components:build-storybook",
		};
		deps.disk.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
	} catch { /* leave as-is if parse fails */ }

	// Disable compodoc in angular.json (storybook init enables it by default)
	const angularPath = deps.paths.join(sbDir, "angular.json");
	try {
		let content = deps.disk.readFileSync(angularPath, "utf-8");
		content = content.replace(/"compodoc":\s*true/g, '"compodoc": false');
		content = content.replace(/"compodocArgs":\s*\[[^\]]*\],?\s*\n?/g, "");
		deps.disk.writeFileSync(angularPath, content, "utf-8");
	} catch { /* leave as-is */ }

	// Remove addon-vitest from main.ts — it requires Vite and is incompatible with Angular
	const mainPath = deps.paths.join(sbDir, ".storybook", "main.ts");
	try {
		let content = deps.disk.readFileSync(mainPath, "utf-8");
		content = content.replace(/\s*"@storybook\/addon-vitest",?\n?/g, "\n");
		deps.disk.writeFileSync(mainPath, content, "utf-8");
	} catch { /* leave as-is */ }

	// Remove compodoc imports from preview.ts — we disable compodoc so documentation.json doesn't exist
	const previewPath = deps.paths.join(sbDir, ".storybook", "preview.ts");
	try {
		let content = deps.disk.readFileSync(previewPath, "utf-8");
		content = content.replace(/import\s*\{?\s*setCompodocJson\s*\}?\s*from\s*["'][^"']+["'];?\n?/g, "");
		content = content.replace(/import\s+docJson\s+from\s+["'][^"']+["'];?\n?/g, "");
		content = content.replace(/setCompodocJson\(docJson\);?\n?/g, "");
		deps.disk.writeFileSync(previewPath, content, "utf-8");
	} catch { /* leave as-is */ }
}

export function installStorybook(projectPath: string, projectName: string, config: ComponentsConfig, deps: StorybookDeps, render: StorybookRenderer = nullStorybookRenderer): boolean {
	const sbDir = resolveStorybookDir(projectPath, config, deps);

	if (isStorybookInstalled(projectPath, config, deps)) {
		render.alreadyInstalled(sbDir);
		return true;
	}

	render.installing(sbDir);

	// Ensure components directory exists
	deps.disk.mkdirSync(sbDir, { recursive: true });

	const framework = config.framework ?? "html";

	// Suppress interactive prompts from Angular CLI and npx
	const nonInteractiveEnv = { NG_CLI_ANALYTICS: "false", npm_config_yes: "true" };

	if (framework === "angular") {
		// Angular requires a workspace scaffold before Storybook init can detect the framework
		writeAngularWorkspacePackageJson(sbDir, projectName, deps);
		writeAngularWorkspace(sbDir, projectName, deps);
		const angularInstall = deps.shell.run("npm install", { cwd: sbDir, label: "Installing Angular workspace", env: nonInteractiveEnv });
		if (angularInstall !== 0) {
			render.installFailed();
			return false;
		}
	} else {
		// Non-Angular: create a minimal package.json so storybook init has something to work with
		writePackageJson(sbDir, projectName, framework, deps);
	}

	// Use official Storybook CLI to install with all features
	// Angular uses webpack — addon-vitest requires Vite, so exclude "test" feature for Angular
	const features = framework === "angular" ? "docs a11y" : "docs test a11y";
	const initCmd = `npx storybook@latest init --yes --features ${features}`;
	const code = deps.shell.run(initCmd, { cwd: sbDir, label: "Installing Storybook", env: nonInteractiveEnv });
	if (code !== 0) {
		render.installFailed();
		return false;
	}

	// Post-init patches: fix config for our component layout
	patchStorybookConfig(sbDir, deps);
	patchStorybookTsconfig(sbDir, deps);
	removeExampleStories(sbDir, deps);
	if (framework === "angular") {
		patchAngularProject(sbDir, deps);
	}

	render.installSuccess(sbDir);
	return true;
}

// ── Vault detection ──────────────────────────────────────────────────

/** Check whether a project path lives inside the Obsidian vault. */
export function isInsideVault(projectPath: string, deps: Pick<StorybookDeps, "paths">): boolean {
	try {
		let resolved = deps.paths.resolve(projectPath);
		let vault = deps.paths.resolve(VAULT_ROOT);
		// Windows paths are case-insensitive
		if (process.platform === "win32") {
			resolved = resolved.toLowerCase();
			vault = vault.toLowerCase();
		}
		return resolved.startsWith(vault + deps.paths.sep) || resolved === vault;
	} catch {
		return false;
	}
}

// ── Browser opening ──────────────────────────────────────────────────

function openInObsidianWebViewer(url: string, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">): boolean {
	if (!isCliAvailable({ shell: deps.shell }) || !isVaultInitialized({ disk: deps.disk, paths: deps.paths })) return false;
	deps.shell.runSilent(`obsidian web url=${url} newtab`);
	return true;
}

function openInDefaultBrowser(url: string, deps: Pick<StorybookDeps, "shell">): void {
	const cmd = process.platform === "win32" ? `start "" "${url}"`
		: process.platform === "darwin" ? `open "${url}"`
		: `xdg-open "${url}"`;
	deps.shell.runSilent(cmd);
}

function openStorybookUrl(projectPath: string, url: string, render: StorybookRenderer, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">): void {
	const inVault = isInsideVault(projectPath, deps);
	if (!inVault) {
		render.browserContext("Not inside vault — using default browser");
	} else if (!isCliAvailable({ shell: deps.shell })) {
		render.browserContext("Obsidian CLI not available — using default browser");
	} else if (!isVaultInitialized({ disk: deps.disk, paths: deps.paths })) {
		render.browserContext("Vault not initialized — using default browser");
	}

	if (inVault && openInObsidianWebViewer(url, deps)) {
		render.openedIn("Obsidian Web Viewer");
	} else {
		openInDefaultBrowser(url, deps);
		render.openedIn("default browser");
	}
}

// ── URL extraction ──────────────────────────────────────────────────

/** Extract the localhost URL from Storybook's output (it reports the actual port). */
export function extractLocalUrl(outputLines: string[]): string {
	for (const line of outputLines) {
		const match = LOCAL_URL_PATTERN.exec(line);
		if (match) return match[0];
	}
	return `http://localhost:${DEFAULT_STORYBOOK_PORT}`;
}

// ── Background process management ───────────────────────────────────

let activeProcess: BackgroundProcess | null = null;

export function isStorybookRunning(): boolean {
	return activeProcess?.running === true;
}

export function stopStorybook(render: StorybookRenderer = nullStorybookRenderer): void {
	if (activeProcess?.running) {
		activeProcess.kill();
		activeProcess = null;
		render.stopped();
	} else {
		render.notRunning();
	}
}

// ── Live output view ────────────────────────────────────────────────

async function enterStorybookView(_projectPath: string, url: string, render: StorybookRenderer, deps: Pick<StorybookDeps, "input">): Promise<void> {
	render.view(url);
	await deps.input.waitForEnter();
	stopStorybook(render);
}

// ── Script wrappers ──────────────────────────────────────────────────

export async function runStorybookDev(projectPath: string, config: ComponentsConfig, deps: StorybookDeps, render: StorybookRenderer = nullStorybookRenderer): Promise<void> {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		await deps.input.waitForEnter();
		return;
	}

	if (isStorybookRunning()) {
		render.alreadyRunning();
		await deps.input.waitForEnter();
		return;
	}

	render.starting();

	// Use npm run storybook which resolves to the correct command per framework
	// CI=true suppresses Storybook interactive prompts; NG_CLI_ANALYTICS=false suppresses Angular analytics prompt
	activeProcess = deps.shell.spawnBackground(
		"npm run storybook",
		{ cwd: sbDir, env: { CI: "true", NG_CLI_ANALYTICS: "false" } },
	);

	// Stream live progress to the renderer while waiting for ready
	const unsubscribe = activeProcess.onOutput((line) => render.progress(line));

	const readyLine = await activeProcess.waitForOutput(READY_PATTERN, READY_TIMEOUT_MS);
	unsubscribe();

	if (!readyLine) {
		if (!activeProcess.running) {
			render.failedToStart();
			const lines = activeProcess.output;
			if (lines.length > 0) {
				render.failOutput(lines.slice(-20));
			}
			activeProcess = null;
		} else {
			render.timeout();
		}
		await deps.input.waitForEnter();
		return;
	}

	const url = extractLocalUrl(activeProcess.output);
	render.ready(url);
	openStorybookUrl(projectPath, url, render, deps);
	await enterStorybookView(projectPath, url, render, deps);
}

export function runStorybookBuild(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "disk" | "paths" | "shell">, render: StorybookRenderer = nullStorybookRenderer): void {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		return;
	}
	deps.shell.run("npm run build-storybook", { cwd: sbDir, label: "Storybook build" });
}

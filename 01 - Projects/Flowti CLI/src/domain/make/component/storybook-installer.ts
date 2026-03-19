/**
 * storybook-installer.ts — Storybook installation and framework configuration.
 *
 * Handles framework package resolution, workspace scaffolding, and post-init
 * patching for the opt-in Storybook component library.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { ComponentsConfig, ComponentFramework } from "../../../infrastructure/types.js";
import type { StorybookRenderer } from "./storybook-renderer.js";
import { nullStorybookRenderer } from "./storybook-renderer.js";

export type StorybookDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "input">;

const DEFAULT_STORYBOOK_DIR = "components";

// ── Detection ────────────────────────────────────────────────────────

export function resolveStorybookDir(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "paths">): string {
	return deps.paths.resolve(projectPath, config.storybookDir ?? DEFAULT_STORYBOOK_DIR);
}

export function isStorybookInstalled(projectPath: string, config: ComponentsConfig, deps: Pick<StorybookDeps, "disk" | "paths">): boolean {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	return deps.disk.existsSync(deps.paths.join(sbDir, "package.json"));
}

// ── Framework-specific packages ──────────────────────────────────────

export interface FrameworkPackages {
	/** The Storybook framework package (used as devDependency AND config import). */
	framework: string;
	/** Additional devDependencies needed for this framework. */
	extra?: Record<string, string>;
}

/**
 * Returns framework-specific package info for Storybook.
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

// ── Installation helpers ─────────────────────────────────────────────

/** Writes a minimal package.json for non-Angular frameworks so storybook init has a project to detect. */
function writePackageJson(sbDir: string, projectName: string, framework: ComponentFramework, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const fw = getFrameworkPackages(framework);
	const pkg = {
		name: `${projectName}-components`,
		version: "1.0.0",
		private: true,
		type: "module",
		devDependencies: {
			[fw.framework]: "latest",
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

/** After Storybook init, patch main config to fix stories glob for scaffold layout. */
function patchStorybookConfig(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	// Storybook init may create main.ts or main.js — try both
	const mainTs = deps.paths.join(sbDir, ".storybook", "main.ts");
	const mainJs = deps.paths.join(sbDir, ".storybook", "main.js");
	const mainPath = deps.disk.existsSync(mainTs) ? mainTs : mainJs;
	try {
		let content = deps.disk.readFileSync(mainPath, "utf-8");
		// Fix stories glob: point to src/ where scaffold writes component stories
		content = content.replace(/\.\.\/stories\//g, "../src/");
		// Remove chromatic addon (not needed for our component library)
		content = content.replace(/\s*"@chromatic-com\/storybook",?\n?/g, "\n");
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

/** Add vitest + a11y addons to main config (skipping broken automigrate scripts). */
function addAddonsToConfig(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const mainTs = deps.paths.join(sbDir, ".storybook", "main.ts");
	const mainJs = deps.paths.join(sbDir, ".storybook", "main.js");
	const mainPath = deps.disk.existsSync(mainTs) ? mainTs : mainJs;
	try {
		let content = deps.disk.readFileSync(mainPath, "utf-8");
		const addons = ["@storybook/addon-vitest", "@storybook/addon-a11y"];
		for (const addon of addons) {
			if (!content.includes(addon)) {
				// Insert before the closing bracket of the addons array
				content = content.replace(
					/(addons:\s*\[)/,
					`$1\n    "${addon}",`,
				);
			}
		}
		deps.disk.writeFileSync(mainPath, content, "utf-8");
	} catch { /* leave as-is */ }
}

/** Add vitest + a11y packages to package.json devDependencies. */
function addAddonDeps(sbDir: string, deps: Pick<StorybookDeps, "disk" | "paths">): void {
	const pkgPath = deps.paths.join(sbDir, "package.json");
	try {
		const pkg = JSON.parse(deps.disk.readFileSync(pkgPath, "utf-8"));
		const devDeps = pkg.devDependencies ?? {};
		devDeps["@storybook/addon-vitest"] = devDeps["@storybook/addon-vitest"] ?? "^10.0.0";
		devDeps["@storybook/addon-a11y"] = devDeps["@storybook/addon-a11y"] ?? "^10.0.0";
		devDeps["vitest"] = devDeps["vitest"] ?? "^4.0.0";
		pkg.devDependencies = devDeps;
		deps.disk.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
	} catch { /* leave as-is */ }
}

// ── Main installation ────────────────────────────────────────────────

export function installStorybook(projectPath: string, projectName: string, config: ComponentsConfig, deps: StorybookDeps, render: StorybookRenderer = nullStorybookRenderer): boolean {
	const sbDir = resolveStorybookDir(projectPath, config, deps);

	if (isStorybookInstalled(projectPath, config, deps)) {
		render.alreadyInstalled(sbDir);
		return true;
	}

	render.installing(sbDir);

	// Ensure components directory exists
	deps.disk.mkdirSync(sbDir, { recursive: true });

	// Isolate from parent project's dependency tree — prevents npm from
	// walking up and finding incompatible packages (e.g. @types/node@^16)
	const npmrcPath = deps.paths.join(sbDir, ".npmrc");
	if (!deps.disk.existsSync(npmrcPath)) {
		deps.disk.writeFileSync(npmrcPath, "legacy-peer-deps=true\n", "utf-8");
	}

	const framework = config.framework ?? "html";

	// Suppress interactive prompts — close stdin so child processes get EOF instead of hanging
	const nonInteractiveEnv = { NG_CLI_ANALYTICS: "false", npm_config_yes: "true", CI: "true" };
	const runOpts = (label: string) => ({ cwd: sbDir, label, env: nonInteractiveEnv, nonInteractive: true });

	if (framework === "angular") {
		// Angular requires a workspace scaffold before Storybook init can detect the framework
		writeAngularWorkspacePackageJson(sbDir, projectName, deps);
		writeAngularWorkspace(sbDir, projectName, deps);
		const angularInstall = deps.shell.run("npm install", runOpts("Installing Angular workspace"));
		if (angularInstall !== 0) {
			render.installFailed();
			return false;
		}
	} else {
		// Non-Angular: create a minimal package.json and install deps so storybook init can detect the framework
		writePackageJson(sbDir, projectName, framework, deps);
		const depInstall = deps.shell.run("npm install", runOpts("Installing framework dependencies"));
		if (depInstall !== 0) {
			render.installFailed();
			return false;
		}
	}

	// Skip storybook init if already configured — only update packages
	const mainTsPath = deps.paths.join(sbDir, ".storybook", "main.ts");
	if (deps.disk.existsSync(mainTsPath)) {
		const updateCode = deps.shell.run("npm install", runOpts("Updating Storybook packages"));
		if (updateCode !== 0) {
			render.installFailed();
			return false;
		}
		render.installSuccess(sbDir);
		return true;
	}

	// Init with docs only — test/a11y automigrates crash on Windows and pull Playwright (~200MB)
	// We add vitest + a11y addons manually after init for a clean single-pass install
	const typeMap: Record<string, string> = { html: "html", angular: "angular", react: "react", vue: "vue3" };
	const typeFlag = typeMap[framework] ? ` --type ${typeMap[framework]}` : "";
	const builderFlag = framework === "angular" ? "" : " --builder vite";
	const initCmd = `npx storybook@latest init --yes --features docs${typeFlag}${builderFlag}`;
	const code = deps.shell.run(initCmd, runOpts("Initializing Storybook"));
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

	// Add test + a11y addons to config and package.json (skipping broken automigrates)
	addAddonsToConfig(sbDir, deps);
	addAddonDeps(sbDir, deps);

	// Single npm install for everything
	const installCode = deps.shell.run("npm install", runOpts("Installing dependencies"));
	if (installCode !== 0) {
		render.installFailed();
		return false;
	}

	render.installSuccess(sbDir);
	return true;
}

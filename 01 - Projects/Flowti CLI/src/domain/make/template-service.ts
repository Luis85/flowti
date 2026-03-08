/**
 * template-service.ts — Centralized, testable template generation.
 *
 * Provides parameterized builders for project config files (manifest.json,
 * package.json, tsconfig.json, esbuild.config.mjs, .gitignore, vitest.config.ts).
 * Each builder is a pure function returning a string — easy to test, easy to compose.
 */

// ── JSON helper ──────────────────────────────────────────────────────

export function toJson(obj: unknown): string {
	return JSON.stringify(obj, null, "\t") + "\n";
}

// ── Manifest ─────────────────────────────────────────────────────────

export interface ManifestOptions {
	id: string;
	name: string;
	author: string;
	version?: string;
	minAppVersion?: string;
	description?: string;
}

export function manifestTemplate(opts: ManifestOptions): string {
	return toJson({
		id: opts.id,
		name: opts.name,
		version: opts.version ?? "0.0.1",
		minAppVersion: opts.minAppVersion ?? "1.12.4",
		description: opts.description ?? `${opts.name} — an Obsidian plugin.`,
		author: opts.author,
		isDesktopOnly: true,
	});
}

// ── Package.json ─────────────────────────────────────────────────────

export type ProjectKind = "app" | "plugin" | "cli";

const SHARED_DEPS = {
	"typescript": "^5.9.0",
	"vitest": "^4.0.0",
} as const;

const OBSIDIAN_DEPS = {
	...SHARED_DEPS,
	"@typescript-eslint/eslint-plugin": "^8.0.0",
	"@typescript-eslint/parser": "^8.0.0",
	"builtin-modules": "^5.0.0",
	"esbuild": "^0.27.0",
	"obsidian": "latest",
	"tslib": "^2.8.0",
	"happy-dom": "^20.0.0",
} as const;

const SCRIPTS_BY_KIND: Record<ProjectKind, Record<string, string>> = {
	plugin: {
		"build": "node esbuild.config.mjs --production",
		"build:dev": "node esbuild.config.mjs --watch",
		"test": "vitest run",
		"check": "tsc -noEmit -skipLibCheck",
		"lint": "eslint ./src/",
	},
	app: {
		"build": "node esbuild.config.mjs --production",
		"build:dev": "node esbuild.config.mjs --watch",
		"test": "npm run check && vitest run",
		"check": "npm run lint && tsc -noEmit -skipLibCheck",
		"lint": "eslint ./src/",
	},
	cli: {
		"dev": "node --import tsx src/main.ts",
		"build": "tsc",
		"test": "vitest run",
		"check": "tsc --noEmit",
	},
};

export function packageTemplate(kind: ProjectKind, name: string, id: string): string {
	const isObsidian = kind !== "cli";
	const devDeps: Record<string, string> = isObsidian
		? { ...OBSIDIAN_DEPS, ...(kind === "app" ? { "@vitest/coverage-v8": "^4.0.0" } : {}) }
		: { "@types/node": "^22.0.0", "tsx": "^4.0.0", ...SHARED_DEPS };

	return toJson({
		name: id,
		version: "0.0.1",
		...(kind === "cli" ? { type: "module" } : {}),
		description: name,
		...(isObsidian ? { main: "main.js" } : {}),
		scripts: SCRIPTS_BY_KIND[kind],
		devDependencies: devDeps,
		dependencies: {},
	});
}

// ── Tsconfig ─────────────────────────────────────────────────────────

export function tsconfigTemplate(kind: ProjectKind): string {
	if (kind === "cli") {
		return toJson({
			compilerOptions: {
				target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext",
				strict: true, esModuleInterop: true,
				outDir: "dist", rootDir: ".", declaration: true, sourceMap: true, skipLibCheck: true,
			},
			include: ["src/**/*.ts"],
			exclude: ["node_modules", "dist"],
		});
	}

	return toJson({
		compilerOptions: {
			target: "ES2022", module: "ESNext", moduleResolution: "bundler",
			lib: ["ES2022", "DOM"],
			strict: true, esModuleInterop: true, skipLibCheck: true,
			outDir: "./dist", declaration: true, sourceMap: true,
			...(kind === "app" ? { types: ["node", "vitest/globals"] } : {}),
		},
		include: kind === "app" ? ["src/**/*.ts", "tests/**/*.ts"] : ["src/**/*.ts"],
		exclude: ["node_modules"],
	});
}

// ── Esbuild ──────────────────────────────────────────────────────────

export function esbuildTemplate(pluginId: string): string {
	return `import esbuild from "esbuild";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";

const isWatch = process.argv.includes("--watch");
const prod = !isWatch;

const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", "${pluginId}");

const concatCSS = () => {
\tconst cssDir = path.resolve(import.meta.dirname, "css");
\tif (!fs.existsSync(cssDir)) return;
\tconst files = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort();
\tif (!files.length) return;
\tconst header = "/* Auto-generated from css/ — do not edit directly */\\n\\n";
\tconst parts = files.map((f) => fs.readFileSync(path.join(cssDir, f), "utf-8"));
\tfs.writeFileSync(path.resolve(import.meta.dirname, "styles.css"), header + parts.join("\\n"), "utf-8");
};

const syncAssets = () => {
\tconcatCSS();
\tfor (const file of ["manifest.json", "styles.css"]) {
\t\tconst src = path.resolve(import.meta.dirname, file);
\t\tif (fs.existsSync(src)) {
\t\t\tfs.mkdirSync(OUTDIR, { recursive: true });
\t\t\tfs.copyFileSync(src, path.join(OUTDIR, file));
\t\t}
\t}
};

const run = async () => {
\tfs.mkdirSync(OUTDIR, { recursive: true });

\tconst ctx = await esbuild.context({
\t\tentryPoints: ["src/main.ts"],
\t\tbundle: true,
\t\toutdir: OUTDIR,
\t\tformat: "cjs",
\t\ttarget: "node16",
\t\tplatform: "node",
\t\tsourcemap: prod ? false : "inline",
\t\texternal: ["obsidian", "electron", ...builtinModules.flatMap((m) => [m, \`node:\${m}\`])],
\t\ttreeShaking: true,
\t\tminify: prod,
\t\tlogLevel: "info",
\t});

\tsyncAssets();

\tif (isWatch) {
\t\tawait ctx.watch();
\t\tconsole.log("[build] Watching...", OUTDIR);
\t\treturn;
\t}

\tawait ctx.rebuild();
\tawait ctx.dispose();
\tconsole.log("[build] Done.", OUTDIR);
};

run().catch((err) => { console.error(err); process.exit(1); });
`;
}

// ── Vitest ───────────────────────────────────────────────────────────

export function vitestTemplate(kind: ProjectKind): string {
	if (kind === "cli") {
		return `import { defineConfig } from "vitest/config";

export default defineConfig({
\ttest: {
\t\tinclude: ["tests/**/*.test.ts"],
\t},
});
`;
	}

	return `import { defineConfig } from "vitest/config";

export default defineConfig({
\ttest: {
\t\tglobals: true,
\t\tenvironment: "happy-dom",
\t\tsetupFiles: ["tests/mocks/obsidian-stub.ts"],
\t\tcoverage: {
\t\t\tprovider: "v8",
\t\t\treporter: ["text", "json-summary"],
\t\t\tinclude: ["src/**/*.ts"],
\t\t},
\t},
});
`;
}

// ── Gitignore ────────────────────────────────────────────────────────

export function gitignoreTemplate(kind: ProjectKind): string {
	const lines = ["node_modules/", "dist/"];
	if (kind !== "cli") lines.push("main.js", "styles.css", "*.js.map");
	return lines.join("\n") + "\n";
}

// ── File writer factory ──────────────────────────────────────────────

import { writeFileAt } from "../../infrastructure/fs.js";
import { log } from "../../infrastructure/logger.js";
import { GREEN, RESET } from "../../infrastructure/ui.js";

export interface WriteResult {
	created: number;
	write: (rel: string, content: string) => void;
	report: (label: string) => void;
}

export function createFileWriter(basePath: string): WriteResult {
	let created = 0;
	return {
		get created() { return created; },
		write(rel: string, content: string): void {
			if (writeFileAt(basePath, rel, content)) created++;
		},
		report(label: string): void {
			log(`  ${GREEN}✓${RESET} Created ${created} files (${label}).\n`);
		},
	};
}

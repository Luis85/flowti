/**
 * cliTemplates.ts — Scaffolding templates for CLI application generation.
 *
 * Creates a Node.js ESM CLI project with TypeScript and Vitest.
 */

export function cliPackageTemplate(name: string, id: string): string {
	return JSON.stringify({
		name: id,
		version: "0.0.1",
		type: "module",
		description: name,
		scripts: {
			"dev": "node --import tsx src/main.ts",
			"build": "tsc",
			"test": "vitest run",
			"check": "tsc --noEmit",
		},
		devDependencies: {
			"@types/node": "^22.0.0",
			"tsx": "^4.0.0",
			"typescript": "^5.9.0",
			"vitest": "^4.0.0",
		},
		dependencies: {},
	}, null, "\t") + "\n";
}

export function cliTsconfigTemplate(): string {
	return JSON.stringify({
		compilerOptions: {
			target: "ES2022",
			module: "NodeNext",
			moduleResolution: "NodeNext",
			strict: true,
			esModuleInterop: true,
			outDir: "dist",
			rootDir: ".",
			declaration: true,
			sourceMap: true,
			skipLibCheck: true,
		},
		include: ["src/**/*.ts"],
		exclude: ["node_modules", "dist"],
	}, null, "\t") + "\n";
}

export function cliMainTemplate(name: string): string {
	return `#!/usr/bin/env node
/**
 * ${name} — CLI entry point.
 */

function main(): void {
\tconst args = process.argv.slice(2);
\tconst command = args[0] ?? "help";

\tswitch (command) {
\t\tcase "help":
\t\t\tlog("${name}");
\t\t\tlog("  help    Show this help message");
\t\t\tbreak;
\t\tdefault:
\t\t\tconsole.error(\`Unknown command: \${command}\`);
\t\t\tprocess.exit(1);
\t}
}

main();
`;
}

export function cliMainTestTemplate(name: string): string {
	return `import { describe, it, expect } from "vitest";

describe("${name}", () => {
\tit("should be a placeholder test", () => {
\t\texpect(true).toBe(true);
\t});
});
`;
}

export function cliVitestTemplate(): string {
	return `import { defineConfig } from "vitest/config";

export default defineConfig({
\ttest: {
\t\tinclude: ["tests/**/*.test.ts"],
\t},
});
`;
}

export function cliGitignoreTemplate(): string {
	return `node_modules/
dist/
`;
}

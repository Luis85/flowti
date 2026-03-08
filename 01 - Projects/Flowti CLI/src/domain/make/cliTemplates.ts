/**
 * cliTemplates.ts — Scaffolding templates for CLI application generation.
 *
 * Creates a Node.js ESM CLI project with TypeScript and Vitest.
 */

import { packageTemplate, tsconfigTemplate, vitestTemplate, gitignoreTemplate } from "./template-service.js";

export function cliPackageTemplate(name: string, id: string): string {
	return packageTemplate("cli", name, id);
}

export function cliTsconfigTemplate(): string {
	return tsconfigTemplate("cli");
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
	return vitestTemplate("cli");
}

export function cliGitignoreTemplate(): string {
	return gitignoreTemplate("cli");
}

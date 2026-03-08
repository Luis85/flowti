/**
 * project-templates.ts — Source code templates for scaffolded Flowti projects.
 *
 * Produces main.ts and a baseline test that passes immediately.
 */

import type { TemplateFn, ScaffoldVariables } from "../scaffold-types.js";

// ── main.ts ──────────────────────────────────────────────────────────

export const mainTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/**
 * main.ts — Entry point for ${vars.name}.
 */

function main(): void {
\tconst args = process.argv.slice(2);

\tif (args.includes("--help") || args.includes("-h")) {
\t\tprintHelp();
\t\treturn;
\t}

\tif (args.includes("--version") || args.includes("-v")) {
\t\tconsole.log("0.0.1");
\t\treturn;
\t}

\tconsole.log("${vars.name} is running.");
}

function printHelp(): void {
\tconsole.log(\`
  ${vars.name}

  Usage:
    node dist/main.js [options]

  Options:
    -h, --help     Show this help
    -v, --version  Show version
\`);
}

main();
`;
};

// ── main.test.ts ─────────────────────────────────────────────────────

export const mainTestTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `import { describe, it, expect } from "vitest";

describe("${vars.name}", () => {
\tit("should have a valid project name", () => {
\t\texpect("${vars.id}").toBeTruthy();
\t});

\tit("should be configured as ES module", () => {
\t\t// Verified by the import statement above — ESM resolution works
\t\texpect(true).toBe(true);
\t});
});
`;
};

// ── Export all ────────────────────────────────────────────────────────

export const projectTemplates: Record<string, TemplateFn> = {
	"project-main": mainTemplate,
	"project-main-test": mainTestTemplate,
};

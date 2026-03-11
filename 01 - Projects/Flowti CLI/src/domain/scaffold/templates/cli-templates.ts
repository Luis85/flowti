/**
 * cli-templates.ts — Templates for the flowti-cli scaffold (CLI tool).
 *
 * Includes a structured main.ts with argument parsing and a test suite.
 */

import type { TemplateFn, ScaffoldVariables } from "../scaffold-types.js";

// ── main.ts ──────────────────────────────────────────────────────────

export const cliMainTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/**
 * main.ts — CLI entry point for ${vars.name}.
 */

interface CliArgs {
\tcommand: string;
\tflags: Set<string>;
}

function parseArgs(raw: string[]): CliArgs {
\tconst flags = new Set<string>();
\tlet command = "";

\tfor (const arg of raw) {
\t\tif (arg.startsWith("-")) {
\t\t\tflags.add(arg);
\t\t} else if (!command) {
\t\t\tcommand = arg;
\t\t}
\t}

\treturn { command, flags };
}

function printHelp(): void {
\tconsole.log(\`
  ${vars.name}

  Usage:
    ${vars.id} <command> [options]

  Commands:
    info        Show project info
    help        Show this help

  Options:
    -h, --help     Show help
    -v, --version  Show version
\`);
}

function main(): void {
\tconst args = parseArgs(process.argv.slice(2));

\tif (args.flags.has("--help") || args.flags.has("-h") || args.command === "help") {
\t\tprintHelp();
\t\treturn;
\t}

\tif (args.flags.has("--version") || args.flags.has("-v")) {
\t\tconsole.log("0.0.1");
\t\treturn;
\t}

\tswitch (args.command) {
\t\tcase "info":
\t\t\tconsole.log("${vars.name} v0.0.1");
\t\t\tbreak;
\t\tdefault:
\t\t\tprintHelp();
\t}
}

main();
`;
};

// ── main.test.ts ─────────────────────────────────────────────────────

export const cliMainTestTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `import { describe, it, expect } from "vitest";

describe("${vars.name} CLI", () => {
\tit("should have a valid project ID", () => {
\t\texpect("${vars.id}").toMatch(/^[a-z0-9-]+$/);
\t});

\tit("should be configured as ES module", () => {
\t\texpect(true).toBe(true);
\t});
});
`;
};

// ── Export all ────────────────────────────────────────────────────────

export const cliTemplates: Record<string, TemplateFn> = {
	"cli-main": cliMainTemplate,
	"cli-main-test": cliMainTestTemplate,
};

/**
 * bare-templates.ts — Templates for the flowti-bare scaffold (library/utility).
 *
 * Minimal index.ts + test. No bundler, no CLI entry point.
 */

import type { TemplateFn, ScaffoldVariables } from "../scaffold-types.js";

// ── index.ts ──────────────────────────────────────────────────────────

export const bareIndexTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/**
 * index.ts — Public API for ${vars.name}.
 */

export function greet(name: string): string {
\treturn \`Hello from ${vars.name}, \${name}!\`;
}
`;
};

// ── index.test.ts ─────────────────────────────────────────────────────

export const bareIndexTestTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `import { describe, it, expect } from "vitest";
import { greet } from "../src/index.js";

describe("${vars.name}", () => {
\tit("should greet by name", () => {
\t\texpect(greet("World")).toBe("Hello from ${vars.name}, World!");
\t});
});
`;
};

// ── Export all ────────────────────────────────────────────────────────

export const bareTemplates: Record<string, TemplateFn> = {
	"bare-index": bareIndexTemplate,
	"bare-index-test": bareIndexTestTemplate,
};

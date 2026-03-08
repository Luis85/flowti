/**
 * component-test.ts — Test file template for components.
 */

import type { ComponentVariables, ComponentDefinition } from "../component-types.js";

export function componentTestTemplate(vars: ComponentVariables, _def: ComponentDefinition): string {
	return `import { describe, it, expect } from "vitest";

describe("${vars.name}", () => {
\tit("has a component definition", async () => {
\t\tconst def = await import("../../src/components/${vars.kebab}/${vars.kebab}.json");
\t\texpect(def.name).toBe("${vars.name}");
\t});
});
`;
}

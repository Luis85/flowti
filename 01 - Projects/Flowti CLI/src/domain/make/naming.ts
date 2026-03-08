/**
 * naming.ts — Naming convention helpers and configurable paths.
 */

export function toKebab(name: string): string {
	return name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

export function toPascal(name: string): string {
	return name.replace(/(?:^|[\s_-])(\w)/g, (_, c: string) => c.toUpperCase()).replace(/[\s_-]/g, "");
}

export function toCamel(name: string): string {
	const pascal = toPascal(name);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export interface MakePaths {
	ui: string;
	domain: string;
	tests: string;
	css: string;
	docs: string;
	journeys: string;
	components: string;
}

const DEFAULT_MAKE_PATHS: MakePaths = {
	ui: "src/ui",
	domain: "src/domain",
	tests: "tests/ui",
	css: "css",
	docs: "docs/features",
	journeys: "tests/e2e/journeys",
	components: "src/ui/components",
};

export function getMakePaths(): MakePaths {
	return { ...DEFAULT_MAKE_PATHS };
}

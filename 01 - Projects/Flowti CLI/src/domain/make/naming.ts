/**
 * naming.ts — Naming convention helpers and configurable paths.
 */

import { config } from "../../infrastructure/config.js";

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

interface MakePaths {
	ui: string;
	domain: string;
	hubDomain: string;
	tests: string;
	css: string;
	docs: string;
	journeys: string;
	components: string;
}

export function getMakePaths(): MakePaths {
	const hub = (config as Record<string, unknown>).make as Record<string, Record<string, string>> | undefined;
	const h = hub?.hub ?? {};
	return {
		ui: h.ui ?? "src/ui",
		domain: h.domain ?? "src/domain",
		hubDomain: h.hubDomain ?? "src/domain/hub",
		tests: h.tests ?? "tests/ui",
		css: h.css ?? "css",
		docs: h.docs ?? "docs/features",
		journeys: h.journeys ?? "tests/e2e/journeys",
		components: h.components ?? "src/ui/components",
	};
}

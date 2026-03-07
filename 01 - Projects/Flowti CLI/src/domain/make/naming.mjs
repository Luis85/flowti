/**
 * naming.mjs — Naming convention helpers and configurable paths.
 */

import { config } from "../../infrastructure/config.mjs";

export function toKebab(name) {
	return name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

export function toPascal(name) {
	return name.replace(/(?:^|[\s_-])(\w)/g, (_, c) => c.toUpperCase()).replace(/[\s_-]/g, "");
}

export function toCamel(name) {
	const pascal = toPascal(name);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function getMakePaths() {
	const hub = config.make?.hub ?? {};
	return {
		ui: hub.ui ?? "src/ui",
		domain: hub.domain ?? "src/domain",
		hubDomain: hub.hubDomain ?? "src/domain/hub",
		tests: hub.tests ?? "tests/ui",
		css: hub.css ?? "css",
		docs: hub.docs ?? "docs/features",
		journeys: hub.journeys ?? "tests/e2e/journeys",
		components: hub.components ?? "src/ui/components",
	};
}

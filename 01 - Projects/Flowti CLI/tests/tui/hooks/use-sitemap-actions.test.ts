import { describe, it, expect } from "vitest";
import { resolvePageActions, type SitemapActionDef } from "../../../src/tui/hooks/use-sitemap-actions.js";
import type { PageAction } from "../../../src/domain/sitemap/unified-page.js";
import type { IConditionRegistry } from "../../../src/infrastructure/condition-registry.js";

const noopRegistry: IConditionRegistry = {
	hasCondition: () => false,
	getCondition: () => () => false,
};

describe("resolvePageActions", () => {
	it("returns keyed actions from page actions", () => {
		const actions: PageAction[] = [
			{ name: "onBuild", label: "Build", type: "handler", target: "build:run", group: "dev" },
			{ name: "onBack", label: "Back", type: "signal", target: "back", group: "nav" },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result).toHaveLength(2);
		expect(result[0].label).toBe("Build");
		expect(result[0].type).toBe("handler");
		expect(result[0].target).toBe("build:run");
		expect(result[0].key).toBeTruthy();
	});

	it("filters hidden actions", () => {
		const actions: PageAction[] = [
			{ name: "onVisible", label: "Visible", type: "handler", target: "a" },
			{ name: "onHidden", label: "Hidden", type: "handler", target: "b", hidden: true },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("Visible");
	});

	it("marks disabled actions", () => {
		const actions: PageAction[] = [
			{ name: "onDisabled", label: "Disabled", type: "handler", target: "a", disabled: true },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result).toHaveLength(1);
		expect(result[0].disabled).toBe(true);
	});

	it("uses explicit key from action", () => {
		const actions: PageAction[] = [
			{ name: "onFoo", label: "Foo", type: "handler", target: "a", key: "f" },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result[0].key).toBe("f");
	});

	it("evaluates string hidden conditions via registry", () => {
		const reg: IConditionRegistry = {
			hasCondition: (id) => id === "no-project",
			getCondition: () => () => true,
		};
		const actions: PageAction[] = [
			{ name: "onHide", label: "Hide Me", type: "handler", target: "a", hidden: "no-project" },
		];
		const result = resolvePageActions(actions, {}, reg);
		expect(result).toHaveLength(0);
	});
});

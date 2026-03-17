import { describe, it, expect } from "vitest";
import { buildTuiFlatContext } from "../../../src/tui/hooks/use-condition-context.js";

describe("buildTuiFlatContext", () => {
	it("maps project existence to 'project' key", () => {
		const result = buildTuiFlatContext({ name: "CLI", path: "/p" }, undefined, undefined);
		expect(result["project"]).toBe(true);
	});

	it("sets project to false when undefined", () => {
		const result = buildTuiFlatContext(undefined, undefined, undefined);
		expect(result["project"]).toBe(false);
	});

	it("maps tools to tools.* keys", () => {
		const result = buildTuiFlatContext(undefined, { esbuild: true, typescript: false }, undefined);
		expect(result["tools.esbuild"]).toBe(true);
		expect(result["tools.typescript"]).toBe(false);
	});

	it("maps config sections to config.* keys", () => {
		const config = { build: { commands: {} }, management: { iterations: {} } };
		const result = buildTuiFlatContext(undefined, undefined, config);
		expect(result["config.build"]).toBe(true);
		expect(result["config.management"]).toBe(true);
		expect(result["config.publish"]).toBe(false);
	});
});

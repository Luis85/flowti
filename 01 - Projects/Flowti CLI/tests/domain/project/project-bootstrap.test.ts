import { describe, it, expect } from "vitest";
import { buildBootstrapConfig } from "../../../src/domain/project/project-bootstrap.js";

describe("buildBootstrapConfig", () => {
	it("generates config with build command mapped to build mode", () => {
		const config = buildBootstrapConfig({ build: "npm run build" });
		expect(config.build.commands.full).toBe("npm run build");
	});

	it("generates config with test command mapped to test preset", () => {
		const config = buildBootstrapConfig({ test: "npm test" });
		expect(config.test.commands.unit).toBe("npm test");
	});

	it("generates config with lint threshold defaults when lint command provided", () => {
		const config = buildBootstrapConfig({ lint: "npm run lint" });
		expect(config.devtools.lint.command).toBe("npm run lint");
	});

	it("sets storybook framework in components section", () => {
		const config = buildBootstrapConfig({ storybook: "react" });
		expect(config.components!.framework).toBe("react");
	});

	it("omits components section when storybook is undefined", () => {
		const config = buildBootstrapConfig({});
		expect(config.components).toBeUndefined();
	});

	it("generates minimal config when all inputs empty", () => {
		const config = buildBootstrapConfig({});
		expect(config.build.commands).toEqual({});
		expect(config.test.commands).toEqual({});
	});
});

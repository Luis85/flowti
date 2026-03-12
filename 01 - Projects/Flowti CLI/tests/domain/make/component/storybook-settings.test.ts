import { describe, it, expect, vi, beforeEach } from "vitest";
import { readComponentsConfig, writeComponentsConfig, getFramework, setFramework } from "../../../../src/domain/make/component/storybook-settings.js";
import type { StorybookSettingsDeps } from "../../../../src/domain/make/component/storybook-settings.js";

function createDeps(files: Record<string, string> = {}): StorybookSettingsDeps {
	const store = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, content: string) => { store[p] = content; }),
			mkdirSync: vi.fn(),
		} as any,
		paths: {
			join: (...args: string[]) => args.join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
		} as any,
	};
}

describe("readComponentsConfig", () => {
	it("returns empty config when no config file exists", () => {
		const deps = createDeps();
		expect(readComponentsConfig("/project", deps)).toEqual({});
	});

	it("reads components section from existing config", () => {
		const deps = createDeps({
			"/project/configs/flowti.config.json": JSON.stringify({
				name: "test",
				components: { framework: "angular", storybook: true },
			}),
		});
		const result = readComponentsConfig("/project", deps);
		expect(result.framework).toBe("angular");
		expect(result.storybook).toBe(true);
	});

	it("returns empty config when config has no components section", () => {
		const deps = createDeps({
			"/project/configs/flowti.config.json": JSON.stringify({ name: "test" }),
		});
		expect(readComponentsConfig("/project", deps)).toEqual({});
	});
});

describe("writeComponentsConfig", () => {
	it("creates config file with components section", () => {
		const deps = createDeps();
		writeComponentsConfig("/project", { framework: "react" }, deps);

		expect(deps.disk.writeFileSync).toHaveBeenCalled();
		const [, content] = (deps.disk.writeFileSync as any).mock.calls[0];
		const parsed = JSON.parse(content);
		expect(parsed.components.framework).toBe("react");
	});

	it("merges into existing config", () => {
		const deps = createDeps({
			"/project/configs/flowti.config.json": JSON.stringify({
				name: "test",
				components: { storybook: true },
			}),
		});
		writeComponentsConfig("/project", { framework: "vue" }, deps);

		const [, content] = (deps.disk.writeFileSync as any).mock.calls[0];
		const parsed = JSON.parse(content);
		expect(parsed.name).toBe("test");
		expect(parsed.components.storybook).toBe(true);
		expect(parsed.components.framework).toBe("vue");
	});
});

describe("getFramework", () => {
	it("returns html by default", () => {
		const deps = createDeps();
		expect(getFramework("/project", deps)).toBe("html");
	});

	it("returns configured framework", () => {
		const deps = createDeps({
			"/project/configs/flowti.config.json": JSON.stringify({
				name: "test",
				components: { framework: "angular" },
			}),
		});
		expect(getFramework("/project", deps)).toBe("angular");
	});
});

describe("setFramework", () => {
	it("writes framework to config", () => {
		const deps = createDeps({
			"/project/configs/flowti.config.json": JSON.stringify({ name: "test" }),
		});
		setFramework("/project", "angular", deps);

		const [, content] = (deps.disk.writeFileSync as any).mock.calls[0];
		const parsed = JSON.parse(content);
		expect(parsed.components.framework).toBe("angular");
	});
});

// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { FlowtiSettingTab, type FlowtiSettingTabDeps } from "../../../src/domain/settings/FlowtiSettingTab";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

function createMockApp(): import("obsidian").App {
	return {} as import("obsidian").App;
}

function createMockPlugin(): import("obsidian").Plugin {
	return { addSettingTab: vi.fn() } as unknown as import("obsidian").Plugin;
}

function createMockDeps(overrides?: Partial<FlowtiSettingTabDeps>): FlowtiSettingTabDeps {
	const settings = { ...DEFAULT_SETTINGS };
	return {
		eventBus: { on: vi.fn(), emit: vi.fn() } as unknown as FlowtiSettingTabDeps["eventBus"],
		getSettings: () => settings,
		saveSettings: vi.fn(async () => {}),
		getInstallerService: vi.fn(async () => ({} as import("../../../src/domain/installer/types").IInstallerService)),
		...overrides,
	};
}

describe("FlowtiSettingTab", () => {
	it("should display without throwing", () => {
		const tab = new FlowtiSettingTab(createMockApp(), createMockPlugin(), createMockDeps());
		expect(() => tab.display()).not.toThrow();
	});

	it("should render section headings", () => {
		const tab = new FlowtiSettingTab(createMockApp(), createMockPlugin(), createMockDeps());
		tab.display();

		const headings = Array.from(tab.containerEl.querySelectorAll("h3")).map((h) => h.textContent);
		expect(headings).toContain("Setup");
		expect(headings).toContain("Event System");
		expect(headings).toContain("Documentation");
		expect(headings).toContain("Entity Folder Paths");
		expect(headings).toContain("General");
	});

	it("should read captureFolder from settings without error", () => {
		const settings = { ...DEFAULT_SETTINGS, captureFolder: "custom/captures" };
		const deps = createMockDeps({ getSettings: () => settings });
		const tab = new FlowtiSettingTab(createMockApp(), createMockPlugin(), deps);

		expect(() => tab.display()).not.toThrow();
	});
});

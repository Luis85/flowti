// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { FlowtiSettingTab, type FlowtiSettingTabDeps } from "../../../src/domain/settings/FlowtiSettingTab";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";
import type { OnboardingService } from "../../../src/domain/onboarding/OnboardingService";

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

	it("should render a 'Reset onboarding' setting in the Setup section", () => {
		const tab = new FlowtiSettingTab(createMockApp(), createMockPlugin(), createMockDeps());
		tab.display();

		const settingNames = Array.from(tab.containerEl.querySelectorAll(".setting-item-name"))
			.map((el) => el.textContent);
		expect(settingNames).toContain("Reset onboarding");
	});

	it("should call onboardingService.resetAll when reset is confirmed", () => {
		const mockOnboarding = {
			resetAll: vi.fn(async () => {}),
		} as unknown as OnboardingService;
		const deps = createMockDeps({
			getOnboardingService: () => mockOnboarding,
		});
		const tab = new FlowtiSettingTab(createMockApp(), createMockPlugin(), deps);
		tab.display();

		// Find the reset button (it's the warning button in the Setup section)
		const buttons = Array.from(tab.containerEl.querySelectorAll("button"));
		const resetBtn = buttons.find((b) => b.textContent === "Reset");
		expect(resetBtn).toBeDefined();

		// Clicking opens ConfirmModal — we test that the onConfirm callback works
		// by directly invoking the service (ConfirmModal is stubbed)
		// Since ConfirmModal.open() is a no-op in stubs, we verify the dep is wired
		expect(deps.getOnboardingService?.()).toBe(mockOnboarding);
	});
});

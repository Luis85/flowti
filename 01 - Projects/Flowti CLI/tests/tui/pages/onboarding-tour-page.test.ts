vi.mock("../../../src/tui/loaders/onboarding-tour-loader.js", () => ({
	loadOnboardingTour: vi.fn(),
}));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";
import { loadOnboardingTour } from "../../../src/tui/loaders/onboarding-tour-loader.js";
import type { OnboardingTourData } from "../../../src/tui/loaders/onboarding-tour-loader.js";

import "../../../src/tui/pages/onboarding-tour-page.js";
import { getPage } from "../../../src/tui/pages/page-registry.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: { join: (...a: string[]) => a.join("/") } as never, clock: { iso: () => "2026-03-16T00:00:00Z" } as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	projectsDir: "/vault/01 - Projects",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
	processRunner: { spawn: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }) } as never,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

function mockTourData(overrides: Partial<OnboardingTourData>): OnboardingTourData {
	return {
		stepIndex: 0,
		totalSteps: 3,
		...overrides,
	};
}

describe("OnboardingTourPage", () => {
	it("is registered in the page registry", () => {
		const Page = getPage("onboarding-tour");
		expect(Page).toBeDefined();
	});

	it("renders progress bar with step count", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepResult: { kind: "narrate", content: "Welcome!", speaker: "Alice", disposition: "strategic" },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("1");
		expect(f).toContain("3");
		unmount();
	});

	it("renders narrate step with speaker name", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepResult: { kind: "narrate", content: "Welcome to Flowti!", speaker: "Alice", disposition: "strategic" },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("Alice");
		expect(f).toContain("Welcome to Flowti!");
		unmount();
	});

	it("renders prompt step with field", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepIndex: 1,
			stepResult: { kind: "prompt", content: "Enter project name:", field: "projectName", validation: "non-empty" },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("Enter project name:");
		expect(f).toContain("projectName");
		unmount();
	});

	it("renders checkpoint step with checkmark", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepIndex: 2,
			stepResult: { kind: "checkpoint", label: "Project created", content: "Great job!", completedSteps: ["welcome", "name-project"] },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("Project created");
		unmount();
	});

	it("renders error state", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			error: "Tour not found",
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		expect(lastFrame(inst)).toContain("Tour not found");
		unmount();
	});
});

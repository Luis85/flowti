// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../mocks/obsidian-stub";
import type { OnboardingService } from "../../src/domain/onboarding/OnboardingService";

// We test renderOnboardingCallout through a concrete subclass (TrainHubView).
// The protected method is the same across all hubs; one is sufficient.
import { TrainHubView } from "../../src/ui/train/TrainHubView";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import type { TrainService } from "../../src/domain/train/TrainService";

// ── Helpers ──────────────────────────────────────────────

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
	return {} as import("obsidian").WorkspaceLeaf;
}

function createMockTrainService(): TrainService {
	return {
		getAllTrains: vi.fn(() => []),
		getActiveTrain: vi.fn(() => undefined),
		getTrain: vi.fn(() => undefined),
		pause: vi.fn(async () => true),
		resume: vi.fn(async () => true),
		deleteTrain: vi.fn(async () => true),
	} as unknown as TrainService;
}

function createMockOnboardingService(overrides: Partial<{
	hasVisited: boolean;
	isCalloutDismissed: boolean;
}> = {}): OnboardingService {
	return {
		hasVisited: vi.fn(() => overrides.hasVisited ?? false),
		isCalloutDismissed: vi.fn(() => overrides.isCalloutDismissed ?? false),
		recordFirstVisit: vi.fn(async () => {}),
		markCalloutDismissed: vi.fn(async () => {}),
	} as unknown as OnboardingService;
}

function prepareContainerEl(view: TrainHubView): void {
	const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
	el.appendChild(document.createElement("div")); // [0] = header
	el.appendChild(document.createElement("div")); // [1] = content area
}

const CALLOUT = {
	id: "train-hub-welcome",
	icon: "train-front",
	title: "Welcome to the Train Hub",
	description: "Capture streams of connected thoughts in timed rides, or start a guided Canvas Session with preconfigured templates for domain design, sprint planning, and more.",
	suggestion: "Start a ride to capture your first train of thought, or try a Canvas Session from the command palette.",
};

// ── Tests ────────────────────────────────────────────────

describe("BaseHubView.renderOnboardingCallout", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	it("renders a callout banner on first visit", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: false });
		const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), vi.fn(), onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		const banner = dashboard.querySelector(".ft-card");
		expect(banner).not.toBeNull();
		expect(banner!.textContent).toContain(CALLOUT.title);
		expect(banner!.textContent).toContain(CALLOUT.description);
	});

	it("does not render callout if already visited", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: true, isCalloutDismissed: false });
		const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), vi.fn(), onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		// There will be other cards (stat cards), but no callout with the welcome title
		const allText = dashboard.textContent ?? "";
		expect(allText).not.toContain(CALLOUT.title);
	});

	it("does not render callout if callout was dismissed", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: true });
		const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), vi.fn(), onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		const allText = dashboard.textContent ?? "";
		expect(allText).not.toContain(CALLOUT.title);
	});

	it("records first visit when callout is shown", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: false });
		const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), vi.fn(), onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		expect(onboarding.recordFirstVisit).toHaveBeenCalledWith("train-hub");
	});

	it("records first visit even when callout is skipped (already visited)", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: true, isCalloutDismissed: false });
		const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), vi.fn(), onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		expect(onboarding.recordFirstVisit).toHaveBeenCalledWith("train-hub");
	});

	it("dismiss button removes the banner and persists dismissal", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: false });
		const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), vi.fn(), onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		// Find the dismiss button (✕)
		const dismissBtn = dashboard.querySelector(".ft-card .ft-nav-link") as HTMLElement;
		expect(dismissBtn).not.toBeNull();
		dismissBtn.click();

		expect(onboarding.markCalloutDismissed).toHaveBeenCalledWith(CALLOUT.id);
		// Banner should be removed from DOM
		const allText = dashboard.textContent ?? "";
		expect(allText).not.toContain(CALLOUT.title);
	});
});

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../mocks/obsidian-stub";
import type { OnboardingService } from "../../src/domain/onboarding/OnboardingService";

import { BaseHubView, type TabDef } from "../../src/ui/BaseHubView";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";

// ── Minimal concrete subclass for testing BaseHubView ───────

class TestHubView extends BaseHubView<string> {
	private onboardingSvc: OnboardingService;

	constructor(
		leaf: import("obsidian").WorkspaceLeaf,
		eventBus: IEventBus,
		onboardingSvc: OnboardingService,
	) {
		super(leaf, eventBus);
		this.onboardingSvc = onboardingSvc;
	}

	getViewType(): string { return "flowti-test-hub"; }
	getDisplayText(): string { return "Test Hub"; }
	getIcon(): string { return "test-tube"; }
	getHubId(): string { return "test-hub"; }
	getHubType(): "system" | "domain" | "user" { return "domain"; }
	getHubDisplayName(): string { return "Test Hub"; }
	getHubIcon(): string { return "test-tube"; }
	getTabDefinitions(): TabDef[] { return []; }
	renderTopBarActions(): void { /* noop */ }
	onTabRender(): void { /* noop */ }
	onHubOpen(): void { /* noop */ }
	onHubClose(): void { /* noop */ }

	onDashboardRender(): void {
		if (!this.dashboardEl) return;
		this.renderOnboardingCallout(this.dashboardEl, this.onboardingSvc, CALLOUT);
	}
}

// ── Helpers ──────────────────────────────────────────────

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
	return {} as import("obsidian").WorkspaceLeaf;
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

function prepareContainerEl(view: TestHubView): void {
	const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
	el.appendChild(document.createElement("div")); // [0] = header
	el.appendChild(document.createElement("div")); // [1] = content area
}

const CALLOUT = {
	id: "test-hub-welcome",
	icon: "test-tube",
	title: "Welcome to the Test Hub",
	description: "This is a test callout for verifying BaseHubView onboarding behavior.",
	suggestion: "Try something to get started.",
};

// ── Tests ────────────────────────────────────────────────

describe("BaseHubView.renderOnboardingCallout", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	it("renders a callout banner on first visit", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: false });
		const view = new TestHubView(createMockLeaf(), eventBus, onboarding);
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
		const view = new TestHubView(createMockLeaf(), eventBus, onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		const allText = dashboard.textContent ?? "";
		expect(allText).not.toContain(CALLOUT.title);
	});

	it("does not render callout if callout was dismissed", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: true });
		const view = new TestHubView(createMockLeaf(), eventBus, onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		const allText = dashboard.textContent ?? "";
		expect(allText).not.toContain(CALLOUT.title);
	});

	it("records first visit when callout is shown", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: false });
		const view = new TestHubView(createMockLeaf(), eventBus, onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		expect(onboarding.recordFirstVisit).toHaveBeenCalledWith("test-hub");
	});

	it("records first visit even when callout is skipped (already visited)", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: true, isCalloutDismissed: false });
		const view = new TestHubView(createMockLeaf(), eventBus, onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		expect(onboarding.recordFirstVisit).toHaveBeenCalledWith("test-hub");
	});

	it("dismiss button removes the banner and persists dismissal", async () => {
		const onboarding = createMockOnboardingService({ hasVisited: false, isCalloutDismissed: false });
		const view = new TestHubView(createMockLeaf(), eventBus, onboarding);
		prepareContainerEl(view);
		await view.onOpen();

		const dashboard = (view as unknown as { dashboardEl: HTMLElement }).dashboardEl;
		const dismissBtn = dashboard.querySelector(".ft-card .ft-nav-link") as HTMLElement;
		expect(dismissBtn).not.toBeNull();
		dismissBtn.click();

		expect(onboarding.markCalloutDismissed).toHaveBeenCalledWith(CALLOUT.id);
		const allText = dashboard.textContent ?? "";
		expect(allText).not.toContain(CALLOUT.title);
	});
});

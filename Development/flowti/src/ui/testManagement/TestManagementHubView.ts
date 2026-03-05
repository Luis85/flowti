/**
 * Test Management Hub — central quality cockpit for journey-based testing.
 *
 * Dashboard shows KPI stat cards, mini pyramid, recent runs, and attention items.
 * Four tabs: Journeys, Pyramid, Coverage, Compliance (implemented in later increments).
 *
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import { setIcon, type WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";
import { BaseHubView, type TabDef } from "../BaseHubView";
import { VIEW_TYPE_TEST_MANAGEMENT_HUB } from "../../domain/hub/types";
import { TestManagementDashboard } from "./TestManagementDashboard";
export { VIEW_TYPE_TEST_MANAGEMENT_HUB };

export type TestMgmtPage = "journeys" | "pyramid" | "coverage" | "compliance";

export class TestManagementHubView extends BaseHubView<TestMgmtPage> {
	private testManagementService: TestManagementService;
	private onboardingService: OnboardingService;
	private dashboard: TestManagementDashboard;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		testManagementService: TestManagementService,
		onboardingService: OnboardingService,
	) {
		super(leaf, eventBus);
		this.testManagementService = testManagementService;
		this.onboardingService = onboardingService;
		this.dashboard = new TestManagementDashboard({
			testManagementService,
			navigateTo: (page) => this.navigateTo(page as TestMgmtPage),
		});
	}

	// ── Identity ────────────────────────────────────────────

	getViewType(): string { return VIEW_TYPE_TEST_MANAGEMENT_HUB; }
	getHubId(): string { return "test-management"; }
	getHubType(): "system" | "domain" | "user" { return "domain"; }
	getHubDisplayName(): string { return "Test Management"; }
	getHubIcon(): string { return "shield-check"; }

	// ── Tabs ────────────────────────────────────────────────

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "journeys", label: "Journeys", icon: "route", searchPlaceholder: "Search journeys..." },
			{ id: "pyramid", label: "Pyramid", icon: "triangle", searchPlaceholder: "Search layers..." },
			{ id: "coverage", label: "Coverage", icon: "check-circle", searchPlaceholder: "Search PRDs..." },
			{ id: "compliance", label: "Compliance", icon: "shield", searchPlaceholder: "Search standards..." },
		];
	}

	// ── Top bar actions ─────────────────────────────────────

	renderTopBarActions(_bar: HTMLElement): void {
		// No top bar actions in Inc 1
	}

	// ── Rendering ───────────────────────────────────────────

	onDashboardRender(): void {
		this.dashboard.render(this.dashboardEl);
	}

	onTabRender(tabId: TestMgmtPage): void {
		this.masterTreeEl.empty();
		this.detailPanelEl.empty();

		const placeholder = this.detailPanelEl.createDiv({ cls: "ft-tm-tab-placeholder" });
		const iconEl = placeholder.createDiv({ cls: "ft-mb-2 ft-opacity-50" });
		const tabIcons: Record<TestMgmtPage, string> = {
			journeys: "route",
			pyramid: "triangle",
			coverage: "check-circle",
			compliance: "shield",
		};
		setIcon(iconEl, tabIcons[tabId] ?? "shield-check");
		placeholder.createDiv({ text: this.getTabLabel(tabId), cls: "ft-heading ft-heading-sm ft-mb-1" });
		placeholder.createDiv({ text: "Coming in a future increment", cls: "ft-text-sm ft-text-muted" });
	}

	// ── Lifecycle ───────────────────────────────────────────

	onHubOpen(): void {
		this.renderOnboardingCallout(this.dashboardEl, this.onboardingService, {
			id: "test-management-welcome",
			icon: "shield-check",
			title: "Welcome to Test Management",
			description: "This hub tracks your journey-based testing: pass rates, coverage, compliance, and the test pyramid.",
			suggestion: "Register journeys from the Journey Builder to get started.",
		});

		// Re-render on domain events
		const events = [
			"test-mgmt.journey.registered",
			"test-mgmt.journey.deregistered",
			"test-mgmt.journey.run-completed",
			"test-mgmt.journey.status-changed",
		] as const;

		for (const event of events) {
			this.addUnsubscribe(
				this.eventBus.on(event, () => this.scheduleRender()),
			);
		}
	}

	onHubClose(): void {
		// Cleanup handled by BaseHubView via addUnsubscribe
	}

	// ── Helpers ──────────────────────────────────────────────

	private getTabLabel(tabId: TestMgmtPage): string {
		const tab = this.getTabDefinitions().find((t) => t.id === tabId);
		return tab?.label ?? tabId;
	}
}

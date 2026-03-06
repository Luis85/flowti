/**
 * Test Management Hub — central quality cockpit for journey-based testing.
 *
 * Dashboard shows KPI stat cards, mini pyramid, recent runs, and attention items.
 * Four tabs: Journeys, Pyramid, Coverage, Compliance.
 *
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";
import type { JourneyStatus, JourneyType } from "../../domain/testManagement/types";
import { BaseHubView, type TabDef } from "../BaseHubView";
import { VIEW_TYPE_TEST_MANAGEMENT_HUB } from "../../domain/hub/types";
import { TestManagementDashboard } from "./TestManagementDashboard";
import { JourneysTab } from "./JourneysTab";
import { PyramidTab } from "./PyramidTab";
import { CoverageTab } from "./CoverageTab";
import { ComplianceTab } from "./ComplianceTab";
import { FeatureQualityTab } from "./FeatureQualityTab";
export { VIEW_TYPE_TEST_MANAGEMENT_HUB };

export type TestMgmtPage = "journeys" | "pyramid" | "coverage" | "compliance" | "feature-quality";

const JOURNEY_TYPES: JourneyType[] = ["functional", "regression", "smoke", "exploratory", "blueprint"];
const JOURNEY_STATUSES: JourneyStatus[] = ["passing", "failing", "never-run", "stale"];

export class TestManagementHubView extends BaseHubView<TestMgmtPage> {
	private testManagementService: TestManagementService;
	private onboardingService: OnboardingService;
	private dashboard: TestManagementDashboard;
	private journeysTab!: JourneysTab;
	private pyramidTab!: PyramidTab;
	private coverageTab!: CoverageTab;
	private complianceTab!: ComplianceTab;
	private featureQualityTab!: FeatureQualityTab;

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
			{ id: "feature-quality", label: "Feature Quality", icon: "star", searchPlaceholder: "Search features..." },
		];
	}

	// ── Top bar actions ─────────────────────────────────────

	renderTopBarActions(bar: HTMLElement): void {
		if (this.getActivePage() !== "journeys") return;

		// Type filter
		const typeSelect = bar.createEl("select", { cls: "dropdown" });
		const typeAll = typeSelect.createEl("option", { text: "All types" });
		typeAll.value = "all";
		for (const t of JOURNEY_TYPES) {
			const opt = typeSelect.createEl("option", { text: t });
			opt.value = t;
		}
		typeSelect.addEventListener("change", () => {
			this.journeysTab.setFilters({ typeFilter: typeSelect.value as JourneyType | "all" });
			this.scheduleRender();
		});

		// Status filter
		const statusSelect = bar.createEl("select", { cls: "dropdown" });
		const statusAll = statusSelect.createEl("option", { text: "All statuses" });
		statusAll.value = "all";
		for (const s of JOURNEY_STATUSES) {
			const opt = statusSelect.createEl("option", { text: s });
			opt.value = s;
		}
		statusSelect.addEventListener("change", () => {
			this.journeysTab.setFilters({ statusFilter: statusSelect.value as JourneyStatus | "all" });
			this.scheduleRender();
		});
	}

	// ── Rendering ───────────────────────────────────────────

	onDashboardRender(): void {
		this.dashboard.render(this.dashboardEl);
	}

	onTabRender(tabId: TestMgmtPage): void {
		if (tabId === "journeys") {
			this.journeysTab.render(this.filterText);
			return;
		}
		if (tabId === "pyramid") {
			this.pyramidTab.render(this.filterText);
			return;
		}
		if (tabId === "coverage") {
			this.coverageTab.render(this.filterText);
			return;
		}
		if (tabId === "compliance") {
			this.complianceTab.render(this.filterText);
			return;
		}
		if (tabId === "feature-quality") {
			this.featureQualityTab.render(this.filterText);
			return;
		}
	}

	// ── Lifecycle ───────────────────────────────────────────

	onHubOpen(): void {
		// Create tab components now that shell elements are available
		this.journeysTab = new JourneysTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.pyramidTab = new PyramidTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.coverageTab = new CoverageTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.complianceTab = new ComplianceTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.featureQualityTab = new FeatureQualityTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});

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

	protected onNavigateToEntity(tabId: string, entityId: string): void {
		if (tabId === "journeys" && this.journeysTab) {
			this.journeysTab.selectByName(entityId);
			this.scheduleRender();
		}
	}

	protected onTabChanged(): void {
		// Reset tab state when switching away
		if (this.getActivePage() !== "journeys" && this.journeysTab) {
			this.journeysTab.resetSelection();
		}
		if (this.getActivePage() !== "pyramid" && this.pyramidTab) {
			this.pyramidTab.resetSelection();
		}
		if (this.getActivePage() !== "coverage" && this.coverageTab) {
			this.coverageTab.resetSelection();
		}
		if (this.getActivePage() !== "compliance" && this.complianceTab) {
			this.complianceTab.resetSelection();
		}
		if (this.getActivePage() !== "feature-quality" && this.featureQualityTab) {
			this.featureQualityTab.resetSelection();
		}
	}

}

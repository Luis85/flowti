/**
 * Handler registration for TestManagement hub tabs.
 *
 * Bridges TestManagementService → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import type { FlowtiEventMap } from "../events/events";
import { setProps } from "./handler-utils";
import { setIcon } from "obsidian";

// Side-effect imports: register Lit custom elements
import "../../components/test-management/flowti-tm-journeys.js";
import "../../components/test-management/flowti-tm-pyramid.js";
import "../../components/test-management/flowti-tm-coverage.js";
import "../../components/test-management/flowti-tm-compliance.js";
import "../../components/test-management/flowti-tm-feature-quality.js";
import "../../components/test-management/flowti-tm-dashboard.js";
import { COMPLIANCE_CHARACTERISTICS } from "../../domain/testManagement/complianceDefinitions.js";
import { computeFeatureQuality } from "../../domain/testManagement/featureQualityCalculator.js";
import type { JourneyRegistryEntry } from "../../domain/testManagement/types";

export interface TestManagementHandlerDeps {
	service: {
		getJourneys: () => unknown[];
		getPyramidWithTrends: () => unknown;
		getBaseline: () => unknown;
		getPrds: () => unknown[];
		getCoverage: (prds: unknown[]) => unknown[];
		getCompliance: () => unknown[];
		setBaseline: () => void;
		addComplianceTag: (journeyName: string, tagId: string) => void;
		removeComplianceTag: (journeyName: string, tagId: string) => void;
		requestReview: (journeyName: string) => void;
	};
	onboardingService: {
		shouldShowCallout: (id: string) => boolean;
	};
	getSettings: () => { docsRootPath: string };
	eventBus: IEventBus;
}

export function registerTestManagementHandlers(
	registry: PluginHandlerRegistry,
	deps: TestManagementHandlerDeps,
): void {
	// ── Lit tab handlers ──────────────────────────────────

	registry.registerTabHandler("test-mgmt:journeys", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-tm-journeys");
		setProps(el, { journeys: deps.service.getJourneys() });
		if (ctx.searchText) {
			setProps(el, { searchText: ctx.searchText });
		}
		el.addEventListener("open-builder", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openJourneyBuilder", e.detail as FlowtiEventMap["ui.openJourneyBuilder"]);
		}) as EventListener);
		el.addEventListener("run-journey", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runJourney", e.detail as FlowtiEventMap["ui.runJourney"]);
		}) as EventListener);
		el.addEventListener("request-review", ((e: CustomEvent) => {
			const detail = e.detail as { name: string };
			deps.service.requestReview(detail.name);
		}) as EventListener);
		container.appendChild(el);
	});

	registry.registerTabHandler("test-mgmt:pyramid", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-tm-pyramid");
		setProps(el, {
			pyramid: deps.service.getPyramidWithTrends(),
			journeys: deps.service.getJourneys(),
			hasBaseline: !!deps.service.getBaseline(),
		});
		el.addEventListener("set-baseline", () => {
			deps.service.setBaseline();
		});
		container.appendChild(el);
	});

	registry.registerTabHandler("test-mgmt:coverage", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-tm-coverage");
		const prds = deps.service.getPrds();
		setProps(el, { coverageEntries: deps.service.getCoverage(prds) });
		container.appendChild(el);
	});

	registry.registerTabHandler("test-mgmt:compliance", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-tm-compliance");
		// Build characteristicsByStandard lookup from static definitions
		const characteristicsByStandard: Record<string, typeof COMPLIANCE_CHARACTERISTICS> = {};
		for (const ch of COMPLIANCE_CHARACTERISTICS) {
			const list = characteristicsByStandard[ch.standard] ??= [];
			list.push(ch);
		}
		setProps(el, {
			scores: deps.service.getCompliance(),
			journeys: deps.service.getJourneys(),
			characteristicsByStandard,
		});
		el.addEventListener("add-tag", ((e: CustomEvent) => {
			const detail = e.detail as { journeyName: string; tagId: string };
			deps.service.addComplianceTag(detail.journeyName, detail.tagId);
		}) as EventListener);
		el.addEventListener("remove-tag", ((e: CustomEvent) => {
			const detail = e.detail as { journeyName: string; tagId: string };
			deps.service.removeComplianceTag(detail.journeyName, detail.tagId);
		}) as EventListener);
		container.appendChild(el);
	});

	registry.registerTabHandler("test-mgmt:feature-quality", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-tm-feature-quality");
		const journeys = deps.service.getJourneys() as JourneyRegistryEntry[];
		// Extract unique feature names from journeys
		const featureNameSet = new Set<string>();
		for (const j of journeys) {
			if (j.feature) featureNameSet.add(j.feature);
			if (j.prd) featureNameSet.add(j.prd);
			if (j.domain) featureNameSet.add(j.domain);
		}
		const features = computeFeatureQuality(journeys, [...featureNameSet]);
		setProps(el, { features, journeys });
		container.appendChild(el);
	});

	// ── Dashboard handler ─────────────────────────────────

	registry.registerTabHandler("test-management:dashboard", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-tm-dashboard");
		setProps(el, {
			journeys: deps.service.getJourneys(),
			pyramid: deps.service.getPyramidWithTrends(),
			onboardingVisible: deps.onboardingService.shouldShowCallout("test-management-welcome"),
		});
		el.addEventListener("navigate-to-tab", ((e: CustomEvent) => {
			const { tabId } = e.detail as { tabId: string };
			void deps.eventBus.emit("ui.navigateTab", { viewId: "flowti-test-management-hub", tabId });
		}) as EventListener);
		container.appendChild(el);
	});

	// ── Catalog wrapper handlers (delegate to existing tab classes) ──

	registry.registerTabHandler("test-mgmt:features", (container: HTMLElement) => {
		container.innerHTML = "";
		const wrapper = container.createDiv({ cls: "ft-empty-state ft-empty-state-centered" });
		const iconEl = wrapper.createDiv();
		setIcon(iconEl, "layers");
		iconEl.addClass("ft-empty-state-icon");
		wrapper.createDiv({ text: "Features Catalog", cls: "ft-empty-state-heading" });
		wrapper.createDiv({
			text: "Map test journeys to product features and track quality per feature area.",
			cls: "ft-text-sm ft-text-muted ft-empty-state-subtitle-mb",
		});
	});

	registry.registerTabHandler("test-mgmt:processes", (container: HTMLElement) => {
		container.innerHTML = "";
		const wrapper = container.createDiv({ cls: "ft-empty-state ft-empty-state-centered" });
		const iconEl = wrapper.createDiv();
		setIcon(iconEl, "workflow");
		iconEl.addClass("ft-empty-state-icon");
		wrapper.createDiv({ text: "Processes Catalog", cls: "ft-empty-state-heading" });
		wrapper.createDiv({
			text: "Define and monitor test processes \u2014 from CI gates to manual review workflows.",
			cls: "ft-text-sm ft-text-muted ft-empty-state-subtitle-mb",
		});
	});

	registry.registerTabHandler("test-mgmt:products", (container: HTMLElement) => {
		container.innerHTML = "";
		const wrapper = container.createDiv({ cls: "ft-empty-state ft-empty-state-centered" });
		const iconEl = wrapper.createDiv();
		setIcon(iconEl, "package");
		iconEl.addClass("ft-empty-state-icon");
		wrapper.createDiv({ text: "Products Catalog", cls: "ft-empty-state-heading" });
		wrapper.createDiv({
			text: "Organize test coverage by product and track release readiness across deliverables.",
			cls: "ft-text-sm ft-text-muted ft-empty-state-subtitle-mb",
		});
	});
}

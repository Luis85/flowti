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
		setProps(el, {
			scores: deps.service.getCompliance(),
			journeys: deps.service.getJourneys(),
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
		setProps(el, { journeys: deps.service.getJourneys() });
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
		container.appendChild(el);
	});

	// ── Catalog wrapper handlers (delegate to existing tab classes) ──

	registry.registerTabHandler("test-mgmt:features", (container: HTMLElement) => {
		container.innerHTML = "";
		container.createDiv({ text: "Features catalog", cls: "ft-text-muted" });
	});

	registry.registerTabHandler("test-mgmt:processes", (container: HTMLElement) => {
		container.innerHTML = "";
		container.createDiv({ text: "Processes catalog", cls: "ft-text-muted" });
	});

	registry.registerTabHandler("test-mgmt:products", (container: HTMLElement) => {
		container.innerHTML = "";
		container.createDiv({ text: "Products catalog", cls: "ft-text-muted" });
	});
}

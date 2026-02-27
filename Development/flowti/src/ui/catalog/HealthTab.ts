/**
 * Health tab for the Event Catalog view.
 *
 * Master panel: overall score card + grouped check list.
 * Detail panel: selected check with affected items.
 */

import { setIcon } from "obsidian";
import { EVENT_CATALOG } from "../../infrastructure/events/catalog";
import { discoveredToCatalogEntries } from "./helpers";
import type { CatalogComponentDeps } from "./types";
import {
	runHealthChecks,
	type HealthReport,
	type HealthCheckResult,
	type HealthSeverity,
	type HealthCheckCategory,
} from "./healthChecks";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<HealthSeverity, string> = {
	pass: "check-circle",
	warn: "alert-triangle",
	fail: "x-circle",
};

const CATEGORY_LABELS: Record<HealthCheckCategory, string> = {
	documentation: "Documentation",
	consistency: "Consistency",
	references: "References",
	coverage: "Coverage",
};

const CATEGORY_ORDER: HealthCheckCategory[] = [
	"documentation",
	"consistency",
	"references",
	"coverage",
];

// ─────────────────────────────────────────────────────────────
// Navigation helpers
// ─────────────────────────────────────────────────────────────

const NAVIGABLE_ENTITY_TYPES = new Set([
	"domain",
	"service",
	"flow",
	"system",
	"actor",
	"product",
	"event",
]);

function navigateToItem(
	deps: CatalogComponentDeps,
	entityType: string,
	name: string,
): void {
	switch (entityType) {
		case "domain":
			deps.navigation.navigateToDomain(name);
			break;
		case "service":
			deps.navigation.navigateToService(name);
			break;
		case "flow":
			deps.navigation.navigateToFlow(name);
			break;
		case "system":
			deps.navigation.navigateToSystem(name);
			break;
		case "actor":
			deps.navigation.navigateToActor(name);
			break;
		case "product":
			deps.navigation.navigateToProduct(name);
			break;
		case "event":
			deps.navigation.navigateToEvent(name);
			break;
	}
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export class HealthTab {
	private report: HealthReport = { overallScore: 100, checks: [] };
	private selectedCheckId: string | null = null;
	private scanCacheKey = "";

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getReport(): HealthReport {
		return this.report;
	}

	render(): void {
		const key = this.computeScanKey();
		if (key !== this.scanCacheKey) {
			this.scan();
			this.scanCacheKey = key;
		}
		this.renderMaster();
		this.renderDetail();
	}

	scan(): void {
		const state = this.deps.getState();
		const discoveredEntries = discoveredToCatalogEntries(
			state.discoveredEvents,
			this.deps.vaultQuery,
			this.deps.getEntityFolder("events"),
		);
		const allEvents = [...EVENT_CATALOG, ...discoveredEntries];
		this.report = runHealthChecks(state, allEvents);
	}

	invalidateCache(): void {
		this.scanCacheKey = "";
	}

	private computeScanKey(): string {
		const s = this.deps.getState();
		const docCount =
			s.domainEntries.filter((d) => d.filePath !== null).length +
			s.serviceEntries.filter((sv) => sv.filePath !== null).length;
		const flowRefs = s.flowEntries.reduce((n, f) => n + f.events.length + f.domains.length + f.services.length, 0);
		const sysRefs = s.systemEntries.reduce((n, sys) => n + sys.domains.length + sys.services.length, 0);
		const actorRefs = s.actorEntries.reduce((n, a) => n + a.events.length, 0);
		const productRefs = s.productEntries.reduce((n, p) => n + p.events.length + p.domains.length, 0);
		return [
			s.domainEntries.length, s.serviceEntries.length, s.flowEntries.length,
			s.systemEntries.length, s.actorEntries.length, s.productEntries.length,
			s.subscriptions.length, s.definitions.length, s.discoveredEvents.length,
			s.showSystemEvents ? 1 : 0, docCount, flowRefs, sysRefs, actorRefs, productRefs,
		].join(",");
	}

	// ─────────────────────────────────────────────────────────
	// Master panel
	// ─────────────────────────────────────────────────────────

	private renderMaster(): void {
		this.masterEl.empty();

		this.renderScoreCard();
		this.renderCheckList();
	}

	private renderScoreCard(): void {
		const card = this.masterEl.createDiv({ cls: "ft-card ft-p-3 ft-mb-3" });
		const content = card.createDiv({
			cls: "ft-flex ft-items-center ft-gap-3",
		});

		const scoreSeverity = this.overallSeverity();
		const scoreEl = content.createDiv({
			text: String(this.report.overallScore),
			cls: `ft-health-score ft-health-score-${scoreSeverity}`,
		});
		scoreEl.setAttribute("aria-label", `Health score: ${this.report.overallScore}%`);

		const info = content.createDiv();
		info.createDiv({
			text: "Vault Health",
			cls: "ft-heading ft-heading-sm",
		});

		const passing = this.report.checks.filter((c) => c.severity === "pass").length;
		info.createDiv({
			text: `${passing} of ${this.report.checks.length} checks passing`,
			cls: "ft-text-sm ft-text-muted",
		});
	}

	private renderCheckList(): void {
		const filterText = this.deps.getState().filterText.toLowerCase();

		for (const category of CATEGORY_ORDER) {
			let checks = this.report.checks.filter((c) => c.category === category);

			if (filterText) {
				checks = checks.filter(
					(c) =>
						c.title.toLowerCase().includes(filterText) ||
						c.summary.toLowerCase().includes(filterText),
				);
			}

			if (checks.length === 0) continue;

			// Category header
			const header = this.masterEl.createDiv({
				cls: "ft-master-category-header",
			});
			header.createSpan({ text: CATEGORY_LABELS[category] });
			header.createSpan({
				text: String(checks.length),
				cls: "ft-master-category-count",
			});

			// Check rows
			for (const check of checks) {
				const isSelected = this.selectedCheckId === check.id;
				const row = this.masterEl.createDiv({
					cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
				});
				row.dataset.id = check.id;

				// Severity dot
				row.createSpan({
					cls: `ft-health-severity ft-health-severity-${check.severity}`,
				});

				// Title
				row.createSpan({ text: check.title });

				// Score badge
				const badge = row.createSpan({
					text: `${Math.round(check.score * 100)}%`,
					cls: `ft-badge ft-badge-${check.severity === "pass" ? "muted" : "accent"}`,
				});
				badge.addClass("ft-ml-auto");

				row.addEventListener("click", () => {
					this.selectedCheckId = check.id;
					this.updateMasterSelection(check.id);
					this.renderDetail();
				});
			}
		}
	}

	private updateMasterSelection(selectedId: string): void {
		this.masterEl.querySelectorAll(".ft-master-event-item").forEach((el) => {
			el.classList.toggle("ft-master-event-selected", (el as HTMLElement).dataset.id === selectedId);
		});
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	private renderDetail(): void {
		this.detailEl.empty();

		const selected = this.report.checks.find(
			(c) => c.id === this.selectedCheckId,
		);

		if (!selected) {
			this.renderDetailEmpty();
			return;
		}

		this.renderDetailHeader(selected);
		this.renderDetailSummary(selected);
		this.renderDetailProgress(selected);
		this.renderDetailItems(selected);
	}

	private renderDetailEmpty(): void {
		const empty = this.detailEl.createDiv({
			cls: "ft-catalog-detail-empty",
		});

		const iconEl = empty.createDiv({ cls: "ft-mb-3" });
		setIcon(iconEl, "heart-pulse");
		iconEl.addClass("ft-opacity-04");
		iconEl.querySelector("svg")?.setAttribute("width", "48");
		iconEl.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({
			text: "Select a health check to view details",
			cls: "ft-text-muted ft-mb-3",
		});

		// Quick stats
		const stats = empty.createDiv({
			cls: "ft-flex ft-gap-4 ft-catalog-quick-stats",
		});

		const passing = this.report.checks.filter((c) => c.severity === "pass").length;
		const totalItems = this.report.checks.reduce((sum, c) => sum + c.items.length, 0);

		this.renderStat(stats, String(this.report.overallScore) + "%", "Overall Score");
		this.renderStat(stats, `${passing} / ${this.report.checks.length}`, "Checks Passing");
		this.renderStat(stats, String(totalItems), "Items to Fix");
	}

	private renderStat(container: HTMLElement, value: string, label: string): void {
		const stat = container.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: value, cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}

	private renderDetailHeader(check: HealthCheckResult): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });

		// Title row
		const titleRow = header.createDiv({
			cls: "ft-flex ft-items-center ft-gap-2",
		});
		const iconEl = titleRow.createSpan();
		setIcon(iconEl, SEVERITY_ICONS[check.severity]);
		iconEl.addClass(`ft-health-severity-icon-${check.severity}`);

		titleRow.createSpan({
			text: check.title,
			cls: "ft-detail-event-type",
		});

		// Badges
		const badges = header.createDiv({
			cls: "ft-flex ft-gap-2 ft-mt-1",
		});

		badges.createSpan({
			text: check.severity.toUpperCase(),
			cls: `ft-badge ft-badge-${check.severity === "pass" ? "muted" : "accent"}`,
		});
		badges.createSpan({
			text: `${Math.round(check.score * 100)}%`,
			cls: "ft-badge ft-badge-muted",
		});
		if (check.items.length > 0) {
			badges.createSpan({
				text: `${check.items.length} item${check.items.length === 1 ? "" : "s"}`,
				cls: "ft-badge ft-badge-muted",
			});
		}
	}

	private renderDetailSummary(check: HealthCheckResult): void {
		const card = this.detailEl.createDiv({ cls: "ft-card ft-p-3 ft-mb-3" });
		card.createDiv({ text: check.summary, cls: "ft-text-sm" });
	}

	private renderDetailProgress(check: HealthCheckResult): void {
		const bar = this.detailEl.createDiv({ cls: "ft-progress-bar ft-mb-3" });
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		fill.style.width = `${Math.round(check.score * 100)}%`;

		fill.addClass(`ft-health-progress-${check.severity}`);
	}

	private renderDetailItems(check: HealthCheckResult): void {
		if (check.items.length === 0) {
			const msg = this.detailEl.createDiv({ cls: "ft-text-muted ft-text-sm ft-p-3" });
			msg.createSpan({ text: "No issues found." });
			return;
		}

		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({
			cls: "ft-detail-section-header",
		});
		sectionHeader.createSpan({
			text: `Affected Items (${check.items.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const item of check.items) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			const isNavigable = NAVIGABLE_ENTITY_TYPES.has(item.entityType);

			const nameEl = row.createSpan({
				text: item.name,
				cls: isNavigable ? "ft-event-type ft-cursor-pointer" : "ft-event-type",
			});

			row.createSpan({
				text: item.reason,
				cls: "ft-catalog-meta ft-text-muted",
			});

			if (isNavigable) {
				nameEl.addEventListener("click", () => {
					navigateToItem(this.deps, item.entityType, item.name);
				});
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────

	private overallSeverity(): HealthSeverity {
		if (this.report.overallScore >= 80) return "pass";
		if (this.report.overallScore >= 50) return "warn";
		return "fail";
	}
}

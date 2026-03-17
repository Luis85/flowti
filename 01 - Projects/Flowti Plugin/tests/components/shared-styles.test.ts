import { describe, it, expect } from "vitest";
import {
	masterDetailLayout,
	statusBadge,
	statCardGrid,
	emptyState,
	searchBar,
} from "../../src/components/shared-styles";

describe("shared-styles", () => {
	it("exports masterDetailLayout as CSSResult", () => {
		expect(masterDetailLayout.cssText).toContain(".master-detail");
		expect(masterDetailLayout.cssText).toContain(".master-list");
		expect(masterDetailLayout.cssText).toContain(".detail-panel");
	});

	it("exports statusBadge with variant classes", () => {
		const css = statusBadge.cssText;
		expect(css).toContain(".status-badge");
		expect(css).toContain(".status-badge--success");
		expect(css).toContain(".status-badge--warning");
		expect(css).toContain(".status-badge--error");
		expect(css).toContain(".status-badge--muted");
		expect(css).toContain(".status-badge--info");
	});

	it("exports statCardGrid", () => {
		expect(statCardGrid.cssText).toContain(".stat-grid");
		expect(statCardGrid.cssText).toContain(".stat-card");
	});

	it("exports emptyState", () => {
		expect(emptyState.cssText).toContain(".empty-state");
	});

	it("exports searchBar", () => {
		expect(searchBar.cssText).toContain(".search-bar");
	});
});

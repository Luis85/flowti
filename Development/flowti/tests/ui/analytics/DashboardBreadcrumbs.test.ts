// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DashboardBreadcrumbs, type BreadcrumbDeps } from "../../../src/ui/analytics/DashboardBreadcrumbs";
import type { NavigationStackEntry } from "../../../src/ui/analytics/types";
import { MAX_BREADCRUMB_DEPTH } from "../../../src/ui/analytics/types";
import "../../mocks/obsidian-stub";

function createContainer(): HTMLElement {
	return document.createElement("div");
}

describe("DashboardBreadcrumbs", () => {
	let container: HTMLElement;
	let onNavigate: (targetIndex: number) => void;
	let onBack: () => void;

	beforeEach(() => {
		container = createContainer();
		onNavigate = vi.fn();
		onBack = vi.fn();
	});

	function render(stack: NavigationStackEntry[]): void {
		new DashboardBreadcrumbs(container, { stack, onNavigate, onBack }).render();
	}

	it("renders nothing when stack has 0 entries", () => {
		render([]);
		expect(container.children.length).toBe(0);
	});

	it("renders nothing when stack has 1 entry (root level)", () => {
		render([{ level: "list", label: "Dashboards" }]);
		expect(container.children.length).toBe(0);
	});

	it("renders breadcrumb bar when stack has 2+ entries", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
		]);
		const bar = container.querySelector(".ft-breadcrumb-bar");
		expect(bar).toBeTruthy();
	});

	it("renders back button", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
		]);
		const backBtn = container.querySelector(".ft-breadcrumb-back");
		expect(backBtn).toBeTruthy();
	});

	it("renders correct breadcrumb segments", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
		]);
		const segments = container.querySelectorAll(".ft-breadcrumb-segment");
		const current = container.querySelectorAll(".ft-breadcrumb-current");
		expect(segments.length).toBe(1); // "Dashboards" is clickable
		expect(current.length).toBe(1); // "Sales" is current (not clickable)
		expect(segments[0].textContent).toBe("Dashboards");
		expect(current[0].textContent).toBe("Sales");
	});

	it("renders separator between segments", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
		]);
		const separators = container.querySelectorAll(".ft-breadcrumb-separator");
		expect(separators.length).toBe(1);
		expect(separators[0].textContent).toBe(" > ");
	});

	it("renders 3-level breadcrumb correctly", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
			{ level: "filtered", label: "Filtered (Region)", dashboardId: "d1" },
		]);
		const segments = container.querySelectorAll(".ft-breadcrumb-segment");
		const current = container.querySelectorAll(".ft-breadcrumb-current");
		expect(segments.length).toBe(2);
		expect(current.length).toBe(1);
		expect(current[0].textContent).toBe("Filtered (Region)");
	});

	it("calls onBack when back button is clicked", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
		]);
		const backBtn = container.querySelector(".ft-breadcrumb-back") as HTMLElement;
		backBtn.click();
		expect(onBack).toHaveBeenCalledOnce();
	});

	it("calls onNavigate with target index when segment is clicked", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
			{ level: "filtered", label: "Filtered", dashboardId: "d1" },
		]);
		// Click "Dashboards" (index 0)
		const segments = container.querySelectorAll(".ft-breadcrumb-segment");
		(segments[0] as HTMLElement).click();
		expect(onNavigate).toHaveBeenCalledWith(0);
	});

	it("does not call onNavigate when current segment is clicked", () => {
		render([
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Sales", dashboardId: "d1" },
		]);
		const current = container.querySelector(".ft-breadcrumb-current") as HTMLElement;
		current.click();
		expect(onNavigate).not.toHaveBeenCalled();
	});
});

describe("MAX_BREADCRUMB_DEPTH", () => {
	it("is 4", () => {
		expect(MAX_BREADCRUMB_DEPTH).toBe(4);
	});
});

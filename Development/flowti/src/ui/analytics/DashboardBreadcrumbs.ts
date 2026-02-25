/**
 * Dashboard breadcrumb navigation bar.
 *
 * Renders a clickable breadcrumb path: "Dashboards > Dashboard Name > Filtered"
 * with a back button (←) for one-level navigation.
 *
 * PBI-ANA-122 (Cycle 43) — FR-95: Dashboard Breadcrumb Navigation.
 */

import { setIcon } from "obsidian";
import type { NavigationStackEntry } from "./types";

export interface BreadcrumbDeps {
	stack: NavigationStackEntry[];
	onNavigate: (targetIndex: number) => void;
	onBack: () => void;
}

export class DashboardBreadcrumbs {
	constructor(
		private container: HTMLElement,
		private deps: BreadcrumbDeps,
	) {}

	render(): void {
		const { stack, onNavigate, onBack } = this.deps;
		if (stack.length <= 1) return; // Hidden at root level

		const bar = this.container.createDiv({ cls: "ft-breadcrumb-bar" });

		// Back button (←)
		const backBtn = bar.createSpan({ cls: "ft-breadcrumb-back" });
		const backIcon = backBtn.createSpan();
		setIcon(backIcon, "arrow-left");
		backBtn.setAttribute("aria-label", "Back");
		backBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			onBack();
		});

		// Breadcrumb segments
		for (let i = 0; i < stack.length; i++) {
			if (i > 0) {
				bar.createSpan({ text: " > ", cls: "ft-breadcrumb-separator" });
			}

			const entry = stack[i];
			const isCurrent = i === stack.length - 1;

			if (isCurrent) {
				bar.createSpan({ text: entry.label, cls: "ft-breadcrumb-current" });
			} else {
				const segment = bar.createSpan({ text: entry.label, cls: "ft-breadcrumb-segment" });
				const idx = i;
				segment.addEventListener("click", (e) => {
					e.stopPropagation();
					onNavigate(idx);
				});
			}
		}
	}
}

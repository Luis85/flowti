/**
 * Shared workspace chrome for Hub views.
 *
 * Renders the top bar (title + breadcrumb + action buttons), tab bar,
 * and provides tab switching. Used internally by BaseHubView to
 * deduplicate chrome construction across Hub subclasses.
 */

import { setIcon } from "obsidian";
import type { ShellConfig, ShellElements, TabDef } from "./types";

export class WorkspaceShell {
	private readonly config: ShellConfig;

	private topBarEl: HTMLElement | null = null;
	private topBarTitleEl: HTMLElement | null = null;
	private countBadge: HTMLElement | null = null;
	private tabBarEl: HTMLElement | null = null;

	constructor(config: ShellConfig) {
		this.config = config;
	}

	/**
	 * Build the shell chrome into a wrapper element.
	 *
	 * Creates the top bar (hidden by default) and tab bar (hidden by default).
	 * Returns element references for the caller to cache.
	 */
	mount(wrapper: HTMLElement): ShellElements {
		this.buildTopBar(wrapper);
		this.tabBarEl = wrapper.createDiv({ cls: "ft-catalog-tab-bar ft-hidden" });
		this.tabBarEl.dataset.testId = "catalog-tab-bar";

		return {
			topBarEl: this.topBarEl!,
			topBarTitleEl: this.topBarTitleEl!,
			countBadge: this.countBadge!,
			tabBarEl: this.tabBarEl,
		};
	}

	/**
	 * Re-render the tab bar with the current active state.
	 */
	renderTabBar(tabs: TabDef[], activePage: string, onTabClick: (tabId: string) => void): void {
		if (!this.tabBarEl) return;

		this.tabBarEl.empty();
		for (const tab of tabs) {
			const btn = this.tabBarEl.createEl("span", {
				cls: `ft-catalog-tab${activePage === tab.id ? " ft-catalog-tab-active" : ""}`,
			});
			btn.dataset.testId = "catalog-tab";
			const iconEl = btn.createSpan();
			setIcon(iconEl, tab.icon);
			btn.appendText(` ${tab.label}`);
			btn.addEventListener("click", () => {
				if (activePage === tab.id) return;
				onTabClick(tab.id);
			});
		}
	}

	/** Clean up shell references. */
	dispose(): void {
		this.topBarEl = null;
		this.topBarTitleEl = null;
		this.countBadge = null;
		this.tabBarEl = null;
	}

	// ── Private ──────────────────────────────────────────────

	private buildTopBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2 ft-hidden ft-border-bottom" });
		bar.addClass("ft-flex-shrink-0");
		this.topBarEl = bar;

		this.topBarTitleEl = bar.createSpan({
			text: this.config.hubName,
			cls: "ft-heading ft-heading-sm",
		});
		this.topBarTitleEl.addClass("ft-cursor-pointer");
		this.topBarTitleEl.addEventListener("click", () => {
			this.config.onNavigateDashboard();
		});

		this.countBadge = bar.createSpan({ cls: "ft-badge ft-badge-muted ft-hidden" });

		// Spacer
		const spacer = bar.createDiv();
		spacer.addClass("ft-flex-1");

		// Subclass-specific action buttons
		this.config.renderTopBarActions(bar);
	}
}

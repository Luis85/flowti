/**
 * Shared rendering helpers for Journey Builder sidebar components.
 *
 * Pure functions — no state, no side effects beyond DOM mutation.
 */
import { setIcon } from "obsidian";

/** Renders the sidebar header bar (route icon + title). */
export function renderHeader(el: HTMLElement): void {
	const header = el.createDiv({ cls: "ft-jb-header" });
	const iconEl = header.createSpan({ cls: "ft-jb-header-icon" });
	setIcon(iconEl, "route");
	const titleEl = header.createSpan({ cls: "ft-jb-header-title", text: "Journey builder" });
	titleEl.dataset.testId = "jb-header-title";
}

/** Renders a "Back" navigation button. */
export function renderBackButton(el: HTMLElement, onBack: () => void): void {
	const backBtn = el.createDiv({ cls: "ft-jb-back-btn" });
	backBtn.dataset.testId = "jb-back-btn";
	backBtn.setAttribute("role", "button");
	backBtn.setAttribute("tabindex", "0");
	const backIcon = backBtn.createSpan({ cls: "ft-jb-back-icon" });
	setIcon(backIcon, "arrow-left");
	backBtn.createSpan({ text: "Back" });
	backBtn.addEventListener("click", onBack);
	backBtn.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onBack();
		}
	});
}

export interface ActionButtonOpts {
	testId: string;
	cls: string;
	icon: string;
	text: string;
	onClick: () => void;
}

/** Renders an icon + text action button with keyboard support. */
export function renderActionButton(el: HTMLElement, opts: ActionButtonOpts): void {
	const btn = el.createDiv({ cls: opts.cls });
	btn.dataset.testId = opts.testId;
	btn.setAttribute("role", "button");
	btn.setAttribute("tabindex", "0");
	const icon = btn.createSpan({ cls: `${opts.cls}-icon` });
	setIcon(icon, opts.icon);
	btn.createSpan({ text: opts.text });
	btn.addEventListener("click", opts.onClick);
	btn.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			opts.onClick();
		}
	});
}

/** Renders a loading spinner with message. */
export function renderLoading(el: HTMLElement, message: string): void {
	const loading = el.createDiv({ cls: "ft-jb-loading" });
	loading.dataset.testId = "jb-loading";
	const spinner = loading.createDiv({ cls: "ft-jb-loading-spinner" });
	setIcon(spinner, "loader");
	loading.createDiv({ cls: "ft-jb-loading-text", text: message });
}

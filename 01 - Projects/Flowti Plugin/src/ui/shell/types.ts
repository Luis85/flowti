import type { TabDef } from "../BaseHubView";

/**
 * Configuration for a WorkspaceShell instance.
 */
export interface ShellConfig {
	/** Display name shown in the top bar breadcrumb. */
	hubName: string;
	/** Callback to navigate back to dashboard when title is clicked. */
	onNavigateDashboard: () => void;
	/** Callback to render subclass-specific action buttons in the top bar. */
	renderTopBarActions: (bar: HTMLElement) => void;
}

/**
 * Elements exposed by WorkspaceShell after mount.
 */
export interface ShellElements {
	topBarEl: HTMLElement;
	topBarTitleEl: HTMLElement;
	countBadge: HTMLElement;
	tabBarEl: HTMLElement;
}

export type { TabDef };

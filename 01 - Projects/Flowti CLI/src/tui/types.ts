/**
 * types.ts — Shared types for the Ink TUI shell.
 */

export interface Section {
	readonly id: string;
	readonly label: string;
	readonly icon: string;
	readonly pages: readonly string[];
}

export interface NavigationState {
	readonly section: string;
	readonly pageStack: readonly string[];
	readonly params: Readonly<Record<string, string>>;
}

export type FocusZone = "activity-bar" | "content" | "actions";

export interface PageProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
}

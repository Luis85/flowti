/**
 * types.ts — Shared types for the Ink TUI shell.
 */

export interface Section {
	readonly id: string;
	readonly label: string;
	readonly icon: string;
	readonly pages: readonly string[];
}

export interface SectionState {
	readonly pageStack: readonly string[];
	readonly params: Readonly<Record<string, string>>;
}

export interface NavigationState {
	readonly activeSection: string;
	readonly sections: Readonly<Record<string, SectionState>>;
}

export type FocusZone = "activity-bar" | "content";

export interface PageProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly onAction?: (actionId: string, params?: Record<string, string>) => void;
	readonly enabled?: boolean;
}

/** Extended page props for data-driven pages. Data comes from loader, onAction handles mutations. */
export interface PageDataProps<T = unknown> extends PageProps {
	readonly data: T;
	readonly onAction: (actionId: string, params?: Record<string, string>) => void;
}

import { PlayerStatus } from "src/models/Player";
import { DayPhase } from "src/simulation/types";

export { BasePanel } from "./panels/BasePanel";
export { PanelBuilder } from "./panels/PanelBuilder"
// Variants
export {
	ListPanel,
	StatsPanel,
	TabbedPanel,
	type ListPanelConfig,
	type ListItem,
	type StatsPanelConfig,
	type Stat,
	type TabbedPanelConfig,
	type Tab,
} from "./panels/PanelVariants";


export interface PanelConfig {
	/** Unique panel identifier */
	id: string;
	/** CSS class suffix (mm-panel mm-{name}) */
	name: string;
	/** Optional panel title for header */
	title?: string;
	/** Optional icon for header */
	icon?: string;
	/** Whether to show header (default: true if title provided) */
	showHeader?: boolean;
	/** Whether to show footer (default: false) */
	showFooter?: boolean;
	/** Additional CSS classes */
	cssClasses?: string[];
}

export interface PanelElements {
	root: HTMLElement;
	header?: HTMLElement;
	headerTitle?: HTMLElement;
	headerActions?: HTMLElement;
	body: HTMLElement;
	footer?: HTMLElement;
}

// Status display config
export const STATUS_CONFIG: Record<PlayerStatus, { icon: string; label: string; color: string }> = {
	idle: { icon: "😊", label: "Ready", color: "var(--color-green, #4ade80)" },
	sleeping: { icon: "😴", label: "Sleeping", color: "var(--color-blue, #60a5fa)" },
	exhausted: { icon: "😵", label: "Exhausted", color: "var(--color-red, #f87171)" },
	active: { icon: "😊", label: "Ready", color: "var(--color-green, #4ade80)" },
};

// Phase icons for compact display
export const PHASE_ICONS: Record<DayPhase, { icon: string; label: string }> = {
	night: { icon: "🌙", label: "Night" },
	morning: { icon: "☀️", label: "Morning" },
	work: { icon: "💼", label: "Work" },
	session: { icon: "🏎️", label: "Session" },
	wrapup: { icon: "📋", label: "Wrap-up" },
};

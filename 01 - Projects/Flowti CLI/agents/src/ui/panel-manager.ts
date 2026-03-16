/**
 * Panel manager — manages a single overlay panel at a time.
 * Pure DOM, no ExcaliburJS dependency.
 */

import { injectPanelStyles } from "./panel-styles.js";
import type { DashboardAgent, ActivityEntry, PermissionEntry } from "../data/types.js";

export interface PanelCallbacks {
	readonly fetchAgent: (name: string) => DashboardAgent | null;
	readonly fetchActivityLog: (agentName: string) => readonly ActivityEntry[];
	readonly fetchPermissions: (agentName: string) => readonly PermissionEntry[];
	readonly onClose: () => void;
	readonly renderContent: (
		container: HTMLElement,
		agentName: string,
		callbacks: PanelCallbacks,
	) => void;
}

export interface PanelManager {
	open(agentName: string, screenX: number, screenY: number): void;
	close(): void;
	isOpen(): boolean;
	getAgentName(): string | null;
}

export function createPanelManager(
	container: HTMLElement,
	callbacks: PanelCallbacks,
): PanelManager {
	let panelEl: HTMLElement | null = null;
	let currentAgent: string | null = null;

	function close(): void {
		if (panelEl && panelEl.parentElement) {
			panelEl.parentElement.removeChild(panelEl);
		}
		panelEl = null;
		currentAgent = null;
		callbacks.onClose();
	}

	function open(agentName: string, screenX: number, screenY: number): void {
		if (panelEl) {
			close();
		}

		injectPanelStyles();

		const panel = document.createElement("div");
		panel.className = "agent-panel";
		panel.style.left = `${screenX}px`;
		panel.style.top = `${screenY}px`;

		callbacks.renderContent(panel, agentName, callbacks);

		container.appendChild(panel);
		panelEl = panel;
		currentAgent = agentName;
	}

	return {
		open,
		close,
		isOpen: () => panelEl !== null,
		getAgentName: () => currentAgent,
	};
}

/**
 * History tab — renders recent activity log filtered to a specific agent.
 * Pure DOM, no API calls — data comes from the state store.
 */

import type { ActivityEntry } from "../data/types.js";

export function renderHistoryTab(
	container: HTMLElement,
	agentName: string,
	activityLog: readonly ActivityEntry[],
): void {
	container.innerHTML = "";

	const filtered = activityLog.filter((entry) => entry.agentName === agentName);

	if (filtered.length === 0) {
		const empty = document.createElement("div");
		empty.className = "agent-panel-empty";
		empty.textContent = "No activity recorded yet.";
		container.appendChild(empty);
		return;
	}

	for (const entry of filtered) {
		const item = document.createElement("div");
		item.className = "agent-panel-history-item";

		const time = document.createElement("div");
		time.className = "agent-panel-history-time";
		time.textContent = entry.timestamp;
		item.appendChild(time);

		const summary = document.createElement("div");
		summary.className = "agent-panel-history-summary";
		summary.textContent = `[${entry.type}] ${entry.summary}`;
		item.appendChild(summary);

		container.appendChild(item);
	}
}

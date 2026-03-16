/**
 * Agent panel — DOM structure with header, info, tabs, and content area.
 * Tabs: Info, Talk, Tasks, Permissions, History.
 * Pure DOM, no ExcaliburJS dependency.
 */

import type {
	DashboardAgent,
	ActivityEntry,
	PermissionEntry,
} from "../data/types.js";
import type { sendMessage, assignTask, grantPermission } from "../data/api-client.js";
import { renderTalkTab } from "./talk-tab.js";
import type { TalkTabOptions } from "./talk-tab.js";
import { renderTasksTab } from "./tasks-tab.js";
import type { TasksTabOptions } from "./tasks-tab.js";
import { renderPermissionsTab } from "./permissions-tab.js";
import type { PendingPermission, PermissionsTabOptions } from "./permissions-tab.js";
import { renderHistoryTab } from "./history-tab.js";

export type TabName = "Info" | "Talk" | "Tasks" | "Permissions" | "History";

const TAB_NAMES: readonly TabName[] = ["Info", "Talk", "Tasks", "Permissions", "History"];

export interface AgentPanelOptions {
	readonly onClose: () => void;
	readonly sendMessage: typeof sendMessage;
	readonly assignTask: typeof assignTask;
	readonly grantPermission: typeof grantPermission;
	readonly baseUrl: string;
	readonly activityLog: readonly ActivityEntry[];
	readonly permissions: readonly PermissionEntry[];
	readonly pendingPermissions: readonly PendingPermission[];
	readonly currentPhase?: string;
}

export function renderAgentPanel(
	container: HTMLElement,
	agent: DashboardAgent,
	options: AgentPanelOptions,
): void {
	container.innerHTML = "";

	// Header
	const header = document.createElement("div");
	header.className = "agent-panel-header";

	const headerLeft = document.createElement("div");

	const nameEl = document.createElement("span");
	nameEl.className = "agent-panel-header-name";
	nameEl.textContent = agent.name;
	headerLeft.appendChild(nameEl);

	const typeEl = document.createElement("span");
	typeEl.className = "agent-panel-header-type";
	typeEl.textContent = agent.agentType;
	headerLeft.appendChild(typeEl);

	header.appendChild(headerLeft);

	const closeBtn = document.createElement("button");
	closeBtn.className = "agent-panel-close";
	closeBtn.textContent = "\u00D7";
	closeBtn.setAttribute("data-testid", "panel-close");
	closeBtn.addEventListener("click", () => options.onClose());
	header.appendChild(closeBtn);

	container.appendChild(header);

	// Info section
	const info = document.createElement("div");
	info.className = "agent-panel-info";

	if (agent.attributes) {
		const grid = document.createElement("div");
		grid.className = "agent-panel-info-grid";

		const attrEntries: [string, number | undefined][] = [
			["STR", agent.attributes.str],
			["INT", agent.attributes.int],
			["WIS", agent.attributes.wis],
			["CHA", agent.attributes.cha],
			["DEX", agent.attributes.dex],
			["CON", agent.attributes.con],
		];

		for (const [label, value] of attrEntries) {
			if (value === undefined) continue;
			const item = document.createElement("div");
			item.className = "agent-panel-info-item";

			const labelEl = document.createElement("div");
			labelEl.className = "agent-panel-info-label";
			labelEl.textContent = label;
			item.appendChild(labelEl);

			const valueEl = document.createElement("div");
			valueEl.className = "agent-panel-info-value";
			valueEl.textContent = String(value);
			item.appendChild(valueEl);

			grid.appendChild(item);
		}

		info.appendChild(grid);
	}

	const meta = document.createElement("div");
	meta.className = "agent-panel-meta";

	if (agent.mood) {
		const moodEl = document.createElement("span");
		moodEl.textContent = `Mood: ${agent.mood}`;
		meta.appendChild(moodEl);
	}

	if (agent.experience !== undefined) {
		const xpEl = document.createElement("span");
		xpEl.textContent = `XP: ${agent.experience}`;
		meta.appendChild(xpEl);
	}

	const statusEl = document.createElement("span");
	statusEl.textContent = `Status: ${agent.status}`;
	meta.appendChild(statusEl);

	info.appendChild(meta);
	container.appendChild(info);

	// Tab bar
	const tabBar = document.createElement("div");
	tabBar.className = "agent-panel-tabs";

	const contentArea = document.createElement("div");
	contentArea.className = "agent-panel-content";

	const tabButtons: HTMLButtonElement[] = [];

	for (const tabName of TAB_NAMES) {
		const btn = document.createElement("button");
		btn.className = "agent-panel-tab";
		btn.textContent = tabName;
		btn.setAttribute("data-tab", tabName);

		btn.addEventListener("click", () => {
			switchTab(tabName);
		});

		tabBar.appendChild(btn);
		tabButtons.push(btn);
	}

	container.appendChild(tabBar);
	container.appendChild(contentArea);

	function switchTab(tabName: TabName): void {
		for (const btn of tabButtons) {
			btn.setAttribute("data-active", String(btn.getAttribute("data-tab") === tabName));
		}

		contentArea.innerHTML = "";

		switch (tabName) {
			case "Info":
				renderInfoContent(contentArea, agent);
				break;
			case "Talk":
				renderTalkTab(contentArea, agent.name, {
					sendMessage: options.sendMessage,
					baseUrl: options.baseUrl,
				} satisfies TalkTabOptions);
				break;
			case "Tasks":
				renderTasksTab(contentArea, agent, {
					assignTask: options.assignTask,
					baseUrl: options.baseUrl,
					currentPhase: options.currentPhase,
					isAiAgent: agent.agentType === "ai",
				} satisfies TasksTabOptions);
				break;
			case "Permissions":
				renderPermissionsTab(contentArea, agent.name, {
					grantPermission: options.grantPermission,
					baseUrl: options.baseUrl,
					pendingPermissions: options.pendingPermissions,
					grantHistory: options.permissions,
				} satisfies PermissionsTabOptions);
				break;
			case "History":
				renderHistoryTab(contentArea, agent.name, options.activityLog);
				break;
		}
	}

	// Default to Info tab
	switchTab("Info");
}

function renderInfoContent(container: HTMLElement, agent: DashboardAgent): void {
	if (agent.persona) {
		const personaEl = document.createElement("div");
		personaEl.textContent = agent.persona;
		personaEl.style.marginBottom = "8px";
		container.appendChild(personaEl);
	}

	if (agent.skills && agent.skills.length > 0) {
		const skillTitle = document.createElement("div");
		skillTitle.textContent = "Skills";
		skillTitle.style.fontWeight = "600";
		skillTitle.style.marginBottom = "4px";
		container.appendChild(skillTitle);

		for (const skill of agent.skills) {
			const el = document.createElement("div");
			el.textContent = `${skill.name}: ${skill.level}`;
			el.style.fontSize = "12px";
			el.style.color = "#94a3b8";
			container.appendChild(el);
		}
	}

	if (agent.relationships && agent.relationships.length > 0) {
		const relTitle = document.createElement("div");
		relTitle.textContent = "Relationships";
		relTitle.style.fontWeight = "600";
		relTitle.style.marginTop = "8px";
		relTitle.style.marginBottom = "4px";
		container.appendChild(relTitle);

		for (const rel of agent.relationships) {
			const el = document.createElement("div");
			el.textContent = `${rel.target} (${rel.type})`;
			el.style.fontSize = "12px";
			el.style.color = "#94a3b8";
			container.appendChild(el);
		}
	}

	if (!agent.persona && (!agent.skills || agent.skills.length === 0) && (!agent.relationships || agent.relationships.length === 0)) {
		const empty = document.createElement("div");
		empty.className = "agent-panel-empty";
		empty.textContent = "No additional information available.";
		container.appendChild(empty);
	}
}

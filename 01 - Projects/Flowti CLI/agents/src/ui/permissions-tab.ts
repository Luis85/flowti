/**
 * Permissions tab — renders pending permission requests and grant history.
 * Pure DOM, calls apiClient.grantPermission() on Allow/Deny.
 */

import type { PermissionEntry } from "../data/types.js";
import type { grantPermission } from "../data/api-client.js";

export interface PendingPermission {
	readonly tool: string;
	readonly requestedAt: string;
}

export interface PermissionsTabOptions {
	readonly grantPermission: typeof grantPermission;
	readonly baseUrl: string;
	readonly pendingPermissions: readonly PendingPermission[];
	readonly grantHistory: readonly PermissionEntry[];
}

export function renderPermissionsTab(
	container: HTMLElement,
	agentName: string,
	options: PermissionsTabOptions,
): void {
	container.innerHTML = "";

	if (options.pendingPermissions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "agent-panel-empty";
		empty.textContent = "No pending permission requests.";
		container.appendChild(empty);
	} else {
		for (const perm of options.pendingPermissions) {
			const item = document.createElement("div");
			item.className = "agent-panel-permission-item";

			const toolEl = document.createElement("span");
			toolEl.className = "agent-panel-permission-tool";
			toolEl.textContent = perm.tool;
			item.appendChild(toolEl);

			const actions = document.createElement("div");
			actions.className = "agent-panel-permission-actions";

			const allowBtn = document.createElement("button");
			allowBtn.className = "agent-panel-permission-allow";
			allowBtn.textContent = "Allow";
			allowBtn.setAttribute("data-tool", perm.tool);
			allowBtn.setAttribute("data-decision", "allow");
			allowBtn.addEventListener("click", () => {
				void options.grantPermission(options.baseUrl, agentName, perm.tool, "allow");
			});
			actions.appendChild(allowBtn);

			const denyBtn = document.createElement("button");
			denyBtn.className = "agent-panel-permission-deny";
			denyBtn.textContent = "Deny";
			denyBtn.setAttribute("data-tool", perm.tool);
			denyBtn.setAttribute("data-decision", "deny");
			denyBtn.addEventListener("click", () => {
				void options.grantPermission(options.baseUrl, agentName, perm.tool, "deny");
			});
			actions.appendChild(denyBtn);

			item.appendChild(actions);
			container.appendChild(item);
		}
	}

	if (options.grantHistory.length > 0) {
		const section = document.createElement("div");
		section.className = "agent-panel-grant-history";

		const title = document.createElement("div");
		title.className = "agent-panel-grant-title";
		title.textContent = "Grant History";
		section.appendChild(title);

		for (const grant of options.grantHistory) {
			const item = document.createElement("div");
			item.className = "agent-panel-grant-item";
			item.textContent = `${grant.tool} (${grant.scope}) — ${grant.grantedAt}`;
			section.appendChild(item);
		}

		container.appendChild(section);
	}
}

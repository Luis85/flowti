/**
 * dashboard-store-tasks.ts — CLI event handler helpers.
 *
 * Extracted from dashboard-store.ts to reduce file size and complexity.
 * Each function handles a single CLI event type using the public API
 * of DashboardStore.
 */

import type { CliEvent } from "../../infrastructure/agents/cli-executor.js";
import { extractAgentMessage } from "../data/message-utils.js";
import type { DashboardStore } from "./dashboard-store.js";

/** Handle a "response" CLI event. */
export function handleCliResponse(store: DashboardStore, agentName: string, event: CliEvent): void {
	const rawText = event.text ?? "";
	const text = extractAgentMessage(rawText);
	if (store.debugMode) store.pushDebugResponse(agentName, rawText);
	store.pushAgentResponse(agentName, text);
	store.pushEventLog(agentName, "response", text.slice(0, 80));
	store.dispatchEvent(new CustomEvent("agent-response-received", {
		detail: { agentName, text, type: "speaking" },
	}));
}

/** Handle a "permission-request" CLI event. */
export function handleCliPermissionRequest(store: DashboardStore, agentName: string, event: CliEvent): void {
	const toolName = event.tool ?? "unknown";
	const pending = store.pendingPermissions.get(agentName) ?? [];
	if (!pending.some((p) => p.tool === toolName)) {
		pending.push({ tool: toolName, requestedAt: Date.now() });
		store.pendingPermissions.set(agentName, pending);
	}
	store.pushEventLog(agentName, "permission-request", `${toolName} \u2014 permission requested`);
	store.dispatchEvent(new CustomEvent("permission-requested", {
		detail: { agentName, tool: toolName, id: event.id },
	}));
}

/** Handle a "using-tool" CLI event. */
export function handleCliUsingTool(store: DashboardStore, agentName: string, event: CliEvent): void {
	const hasSummary = event.text && event.text !== event.tool;
	const toolSummary = hasSummary ? event.text! : (event.tool ?? "tool");
	store.pushEventLog(agentName, "using-tool", toolSummary);
	if (hasSummary) store.pushAgentThought(agentName, `\u{1f527} ${toolSummary}`);
	store.dispatchEvent(new CustomEvent("agent-using-tool", {
		detail: { agentName, tool: event.tool ?? "tool" },
	}));
}

/** Handle a "tool-complete" CLI event. */
export function handleCliToolComplete(store: DashboardStore, agentName: string, event: CliEvent): void {
	const toolName = event.tool ?? "tool";
	store.pushEventLog(agentName, "tool-complete", `${toolName} done`);
	store.dispatchEvent(new CustomEvent("agent-tool-complete", {
		detail: { agentName, tool: toolName },
	}));
}

/**
 * workspace-events.ts — Typed event map for workspace lifecycle.
 *
 * Each key is an event name emitted during workspace state transitions.
 * Consumers subscribe via the EventBus or pipeline hooks.
 */

import type { AgentWorkspace } from "./agent-workspace.js";
import type { CollectResult } from "./agent-shell.js";

export interface WorkspaceEventMap {
	"workspace:provisioned": { readonly workspace: AgentWorkspace; readonly method: "worktree" | "clone" };
	"workspace:ready": { readonly workspace: AgentWorkspace };
	"workspace:active": { readonly workspace: AgentWorkspace; readonly pid: number };
	"workspace:collecting": { readonly workspace: AgentWorkspace; readonly collectResult: CollectResult };
	"workspace:disposed": { readonly workspace: AgentWorkspace };
	"workspace:retained": { readonly workspace: AgentWorkspace };
	"workspace:orphaned": { readonly workspace: AgentWorkspace };
	"workspace:completed": { readonly workspace: AgentWorkspace; readonly agentSlug: string; readonly task: string; readonly exitCode: number };
	"workspace:error": { readonly workspace: AgentWorkspace; readonly error: string };
}

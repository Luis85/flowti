/**
 * tool-registry.ts — Default tool definitions available to agents.
 *
 * Each entry describes a CLI-executable tool: its id, display label,
 * the shell command to run, which agent domains it is relevant for,
 * conditions that trigger auto-suggestion, cooldown, and whether the
 * agent must request human approval before running.
 */

import type { AgentTool } from "./world-config.js";

/** The six built-in tools available to all agents. */
export const DEFAULT_TOOLS: readonly AgentTool[] = [
	{
		id: "health-check",
		label: "Run health check",
		command: "flowti health --format=json",
		domains: ["engineering", "operations", "quality"],
		triggers: ["error", "task-failed", "morale-low"],
		cooldownMs: 60000,
		requiresApproval: false,
	},
	{
		id: "run-tests",
		label: "Run tests",
		command: "flowti test",
		domains: ["engineering", "quality"],
		triggers: ["task-completed", "build-succeeded"],
		cooldownMs: 30000,
		requiresApproval: false,
	},
	{
		id: "generate-report",
		label: "Generate report",
		command: "flowti reports",
		domains: ["analysis", "product", "management"],
		triggers: ["idle", "iteration-complete"],
		cooldownMs: 120000,
		requiresApproval: false,
	},
	{
		id: "build",
		label: "Build project",
		command: "flowti build",
		domains: ["engineering", "operations"],
		triggers: ["task-completed", "deploy-requested"],
		cooldownMs: 45000,
		requiresApproval: true,
	},
	{
		id: "iteration-status",
		label: "Check iteration status",
		command: "flowti info --format=json",
		domains: ["management", "orchestration", "product"],
		triggers: ["idle", "phase-transition"],
		cooldownMs: 30000,
		requiresApproval: false,
	},
	{
		id: "validate-sitemap",
		label: "Validate sitemap",
		command: "flowti sitemap:validate",
		domains: ["engineering", "design"],
		triggers: ["ui-change", "sitemap-modified"],
		cooldownMs: 20000,
		requiresApproval: false,
	},
];

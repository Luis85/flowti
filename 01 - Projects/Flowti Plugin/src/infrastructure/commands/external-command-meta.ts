/**
 * Metadata for commands registered outside the CommandRegistry
 * (e.g., DataExchangeSetup, SessionSetup, main.ts).
 *
 * Extracted from command-definitions.ts to stay under max-lines.
 */

import type { CommandMeta } from "./types";

export function getExternalCommandMeta(): CommandMeta[] {
	return [
		// Installer command
		{
			id: "flowti:open-installer",
			label: "Open installer",
			description: "Open the installer wizard (only available when Flowti is not installed)",
			domain: "installer",
			category: "action",
			icon: "download",
		},
		// Data Exchange commands
		{
			id: "flowti:import-csv",
			label: "Import CSV as notes",
			description: "Import a CSV file and create vault notes from each row",
			domain: "data-exchange",
			category: "action",
			icon: "file-input",
		},
		{
			id: "flowti:export-csv",
			label: "Export as CSV",
			description: "Export vault notes or a database view as a CSV file",
			domain: "data-exchange",
			category: "action",
			icon: "file-output",
		},
		{
			id: "flowti:export-tab",
			label: "Export as tab-delimited",
			description: "Export vault notes or a database view as a tab-delimited file",
			domain: "data-exchange",
			category: "action",
			icon: "file-output",
		},
		{
			id: "flowti:open-data-exchange",
			label: "Open data exchange hub",
			description: "Open the data exchange hub for import/export management",
			domain: "data-exchange",
			category: "view",
			icon: "arrow-left-right",
		},
		{
			id: "flowti:signal-sync",
			label: "Sync all signals",
			description: "Synchronize all configured signal connections",
			domain: "data-exchange",
			category: "action",
			icon: "radio",
		},
		{
			id: "flowti:import-canvas",
			label: "Import canvas as notes",
			description: "Import an Obsidian canvas file and create notes from nodes",
			domain: "data-exchange",
			category: "action",
			icon: "layout-dashboard",
		},
		// Session commands
		{
			id: "flowti:open-session-workspace",
			label: "Open session workspace",
			description: "Open the session workspace in a new tab",
			domain: "session",
			category: "view",
			icon: "timer",
		},
		{
			id: "flowti:open-session-workspace-sidebar",
			label: "Open session workspace in sidebar",
			description: "Open the session workspace in the right sidebar panel",
			domain: "session",
			category: "view",
			icon: "panel-right",
		},
		{
			id: "flowti:create-session",
			label: "Create new session",
			description: "Create a new timed work session with goals and focus",
			domain: "session",
			category: "action",
			icon: "timer",
		},
		{
			id: "flowti:resume-session",
			label: "Resume paused session",
			description: "Resume a previously paused work session",
			domain: "session",
			category: "action",
			icon: "play",
		},
	];
}

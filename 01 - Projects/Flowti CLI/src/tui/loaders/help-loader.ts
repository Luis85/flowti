/**
 * help-loader.ts — Help topics loader.
 *
 * Returns static help sections for the help page.
 */

import type { LoaderContext } from "./loader-types.js";

export interface HelpSection {
	readonly title: string;
	readonly description: string;
}

export interface HelpData {
	readonly sections: readonly HelpSection[];
}

export function loadHelp(_ctx: LoaderContext): HelpData {
	try {
		return {
			sections: [
				{ title: "Getting Started", description: "Initialize a project and configure flowti.config.json" },
				{ title: "Build & Test", description: "Run build commands and test presets for your project" },
				{ title: "Reports", description: "Generate and view project health, coverage, and quality reports" },
				{ title: "Agents", description: "Manage AI agents, assign roles, and orchestrate tasks" },
				{ title: "Scaffold", description: "Create new projects from scaffold definitions" },
				{ title: "Events", description: "Browse and manage event definitions in the event catalog" },
				{ title: "Iterations", description: "Plan, track, and review project iterations" },
				{ title: "Keyboard Shortcuts", description: "Press ? on any page to see available actions" },
			],
		};
	} catch { return { sections: [] }; }
}

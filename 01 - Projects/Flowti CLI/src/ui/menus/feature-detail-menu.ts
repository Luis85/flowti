/**
 * feature-detail-menu.ts — Reduced detail menu for standalone features.
 *
 * Shows only lifecycle + management subset (no Build, Review, Publish, Dev Tools).
 */

import type { MenuEntry } from "../../infrastructure/types.js";

export function buildFeatureDetailMenu(featurePath: string, featureName: string): MenuEntry[] {
	return [
		{
			key: "1",
			label: "Lifecycle",
			action: async () => {
				const { lifecycleStatusMenu } = await import("./lifecycle-menu.js");
				return lifecycleStatusMenu(featurePath, featureName, "feature");
			},
		},
		{
			key: "2",
			label: "Requirements Management",
			action: async () => {
				const { requirementsMenu } = await import("./requirements-menu.js");
				return requirementsMenu(featurePath);
			},
		},
		{
			key: "3",
			label: "Deliverables",
			action: async () => {
				const { deliverablesMenu } = await import("./deliverables-menu.js");
				return deliverablesMenu(featurePath);
			},
		},
		{
			key: "4",
			label: "RAID Log",
			action: async () => {
				const { raidMenu } = await import("./raid-menu.js");
				return raidMenu(featurePath);
			},
		},
		{
			key: "5",
			label: "CAPA",
			action: async () => {
				const { capaMenu } = await import("./capa-menu.js");
				return capaMenu(featurePath);
			},
		},
		{ separator: true },
		{ key: "b", label: "Back to Start Menu", action: () => "start" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];
}

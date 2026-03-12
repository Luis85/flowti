/**
 * management-menu.ts — Project Management submenu.
 *
 * Aggregates Resources, Time-Log, Deliverables, RAID Log, Requirements, CAPA, and Health under one menu.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuResult, MenuEntry, ProjectContext } from "../../infrastructure/types.js";
import { collectHealth } from "../../domain/health/health.js";
import { displayHealth } from "../health-display.js";

export async function managementMenu(ctx: ProjectContext): Promise<MenuResult> {
	const mgmt = ctx.config.management;
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "Resources",
			action: async () => {
				const { resourcesMenu } = await import("./resources-menu.js");
				return resourcesMenu(ctx.path, mgmt?.resources);
			},
		},
		{
			key: "2",
			label: "Time-Log",
			action: async () => {
				const { timelogMenu } = await import("./timelog-menu.js");
				return timelogMenu(ctx.path, mgmt?.timelog);
			},
		},
		{
			key: "3",
			label: "Deliverables",
			action: async () => {
				const { deliverablesMenu } = await import("./deliverables-menu.js");
				return deliverablesMenu(ctx.path, mgmt?.deliverables);
			},
		},
		{
			key: "4",
			label: "RAID Log",
			action: async () => {
				const { raidMenu } = await import("./raid-menu.js");
				return raidMenu(ctx.path, mgmt?.raid);
			},
		},
		{
			key: "5",
			label: "Requirements",
			action: async () => {
				const { requirementsMenu } = await import("./requirements-menu.js");
				return requirementsMenu(ctx.path, mgmt?.requirements);
			},
		},
		{
			key: "6",
			label: "CAPA",
			action: async () => {
				const { capaMenu } = await import("./capa-menu.js");
				return capaMenu(ctx.path, mgmt?.capa);
			},
		},
		{
			key: "7",
			label: "Health",
			action: async () => {
				const health = collectHealth({ disk, paths, shell }, ctx);
				displayHealth(health);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Project Management", items);
}

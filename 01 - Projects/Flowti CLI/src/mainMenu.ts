/**
 * mainMenu.ts — Main menu items for the Flowti CLI.
 *
 * Data-driven menu definition — each item carries its action function.
 */

import { menu as makeMenu } from "./domain/make/make.js";
import { menu as buildMenu } from "./domain/build/build.js";
import { menu as reviewMenu } from "./domain/review/review.js";
import { menu as publishMenu } from "./domain/publish/publish.js";
import { menu as reportsMenu } from "./domain/reports/reports.js";
import { menu as devToolsMenu } from "./domain/devtools/devtools.js";
import { showInfo } from "./domain/info/info.js";
import { showHelp } from "./domain/help/help.js";
import { captureIdea, captureNote } from "./domain/capture/capture.js";
import { projectSelectionMenu } from "./domain/project/project.js";
import { knowledgebaseMenu, isKnowledgebaseAvailable } from "./domain/knowledgebase/knowledgebase.js";
import type { MenuEntry } from "./types.js";

export const mainMenuItems: MenuEntry[] = [
	{ key: "1", label: "Make", action: makeMenu },
	{ key: "2", label: "Build", action: buildMenu },
	{ key: "3", label: "Review", action: reviewMenu },
	{ key: "4", label: "Publish", action: publishMenu },
	{ key: "5", label: "Reports", action: reportsMenu },
	{ key: "6", label: "Dev Tools", action: devToolsMenu },
	{ key: "7", label: "Info", action: () => { showInfo(); return "main" as const; } },
	{ separator: true },
	{ key: "8", label: "Capture Idea", action: captureIdea },
	{ key: "9", label: "Capture Note", action: captureNote },
	{ key: "k", label: "Knowledgebase", action: knowledgebaseMenu, disabled: () => !isKnowledgebaseAvailable(), disabledMessage: "\n  Knowledgebase requires Obsidian CLI and an initialized vault.\n" },
	{ separator: true },
	{ key: "p", label: "Change Project", action: async () => { await projectSelectionMenu(); return "main" as const; } },
	{ key: "?", label: "Help", action: () => { showHelp("main"); return "main" as const; } },
	{ key: "q", label: "Quit", action: () => "quit" as const },
];

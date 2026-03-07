/**
 * mainMenu.mjs — Main menu items for the Flowti CLI.
 *
 * Data-driven menu definition — each item carries its action function.
 */

import { menu as makeMenu } from "./domain/make/make.mjs";
import { menu as buildMenu } from "./domain/build/build.mjs";
import { menu as reviewMenu } from "./domain/review/review.mjs";
import { menu as publishMenu } from "./domain/publish/publish.mjs";
import { menu as reportsMenu } from "./domain/reports/reports.mjs";
import { menu as devToolsMenu } from "./domain/devtools/devtools.mjs";
import { showInfo } from "./domain/info/info.mjs";
import { showHelp } from "./domain/help/help.mjs";
import { captureIdea, captureNote } from "./domain/capture/capture.mjs";
import { projectSelectionMenu } from "./domain/project/project.mjs";

export const mainMenuItems = [
	{ key: "1", label: "Make", action: makeMenu },
	{ key: "2", label: "Build", action: buildMenu },
	{ key: "3", label: "Review", action: reviewMenu },
	{ key: "4", label: "Publish", action: publishMenu },
	{ key: "5", label: "Reports", action: reportsMenu },
	{ key: "6", label: "Dev Tools", action: devToolsMenu },
	{ key: "7", label: "Info", action: () => { showInfo(); return "main"; } },
	{ separator: true },
	{ key: "8", label: "Capture Idea", action: captureIdea },
	{ key: "9", label: "Capture Note", action: captureNote },
	{ separator: true },
	{ key: "p", label: "Change Project", action: async () => { await projectSelectionMenu(); return "main"; } },
	{ key: "?", label: "Help", action: () => { showHelp("main"); return "main"; } },
	{ key: "q", label: "Quit", action: () => "quit" },
];

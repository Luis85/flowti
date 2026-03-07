/**
 * mainMenu.ts — Dynamic project detail menu for the Flowti CLI.
 *
 * Builds menu items from the project's flowti.config.json tool mappings,
 * package.json scripts, and static utilities.
 */

import { menu as makeMenu } from "./domain/make/make.js";
import { publishMenu } from "./domain/publish/project-publish.js";
import { showInfo } from "./domain/info/info.js";
import { showHelp } from "./domain/help/help.js";
import { captureIdea, captureNote } from "./domain/capture/capture.js";
import {
  knowledgebaseMenu,
  isKnowledgebaseAvailable,
} from "./domain/knowledgebase/knowledgebase.js";
import { generateProjectStatusReport } from "./domain/reports/cli/generate-status-report.js";
import { runIn } from "./infrastructure/shell.js";
import { getSelectedProject } from "./infrastructure/state.js";
import { initializeProject } from "./domain/project/project-config.js";
import { FLOWTI_TOOLS } from "./types.js";
import type { MenuEntry, ProjectConfig } from "./types.js";

// ── Build Flowti tool items (top-level, disabled if unmapped) ────────

function buildToolItems(
  projectPath: string,
  config: ProjectConfig,
): MenuEntry[] {
  const tools = config.tools ?? {};
  return FLOWTI_TOOLS.map((def) => {
    const cmd = tools[def.id];
    if (cmd) {
      return {
        key: def.key,
        label: def.label,
        action: () => {
          runIn(cmd, projectPath, def.label);
          return "main" as const;
        },
      };
    }
    return {
      key: def.key,
      label: def.label,
      action: () => "main" as const,
      disabled: true,
      disabledMessage: `\n  ${def.label} is not mapped. Add "${def.id}" to tools in flowti.config.json.\n`,
    };
  });
}

// ── Build script listing from package.json ──────────────────────────

function buildScriptItems(
  projectPath: string,
  scripts: Record<string, string>,
): MenuEntry[] {
  const names = Object.keys(scripts);
  if (names.length === 0) return [];

  return names.map((name) => ({
    key: name,
    label: `npm run ${name}`,
    action: () => {
      runIn(`npm run ${name}`, projectPath, name);
      return "main" as const;
    },
  }));
}

// ── Public: build full menu for current project ─────────────────────

export function buildProjectDetailMenu(): MenuEntry[] {
  const projectName = getSelectedProject();
  if (!projectName) return buildFallbackMenu();

  const ctx = initializeProject(projectName);
  const toolItems = buildToolItems(ctx.path, ctx.config);
  const scriptItems = buildScriptItems(ctx.path, ctx.scripts);

  const items: MenuEntry[] = [];

  // Make (always available)
  items.push({
    key: "1",
    label: "Make",
    action: () => makeMenu(ctx.path),
  });

  // Flowti tools (disabled if unmapped)
  items.push(...toolItems);

  // Publish (always available)
  items.push({
    key: "4",
    label: "Publish",
    action: () => publishMenu(ctx.path, ctx.config.publish ?? {}),
  });

  items.push({ separator: true });

  // Project-level utilities
  items.push(
    { key: "8", label: "Capture Idea", action: captureIdea },
    { key: "9", label: "Capture Note", action: captureNote },
    {
      key: "k",
      label: "Knowledgebase",
      action: knowledgebaseMenu,
      disabled: () => !isKnowledgebaseAvailable(),
      disabledMessage:
        "\n  Knowledgebase requires Obsidian CLI and an initialized vault.\n",
    },
    {
      key: "s",
      label: "Project Status Report",
      action: async () => {
        await generateProjectStatusReport();
        return "main" as const;
      },
    },
  );

  // All npm scripts submenu
  if (scriptItems.length > 0) {
    items.push({
      key: "r",
      label: "Run npm script...",
      action: async () => {
        const { runMenu } = await import("./infrastructure/menu.js");
        const scriptMenuItems: MenuEntry[] = [
          ...scriptItems,
          { separator: true },
          { key: "b", label: "Back", action: () => "main" as const },
        ];
        await runMenu("npm scripts", scriptMenuItems);
        return "main" as const;
      },
    });
  }

  items.push({ separator: true });

  // Navigation
  items.push(
    {
      key: "i",
      label: "Info",
      action: () => {
        showInfo();
        return "main" as const;
      },
    },
    { key: "b", label: "Back to Start Menu", action: () => "start" as const },
    {
      key: "?",
      label: "Help",
      action: () => {
        showHelp("main");
        return "main" as const;
      },
    },
    { key: "q", label: "Quit", action: () => "quit" as const },
  );

  return items;
}

// ── Fallback (no project) ───────────────────────────────────────────

function buildFallbackMenu(): MenuEntry[] {
  return [
    {
      key: "i",
      label: "Info",
      action: () => {
        showInfo();
        return "main" as const;
      },
    },
    {
      key: "?",
      label: "Help",
      action: () => {
        showHelp("main");
        return "main" as const;
      },
    },
    { separator: true },
    { key: "b", label: "Back to Start Menu", action: () => "start" as const },
    { key: "q", label: "Quit", action: () => "quit" as const },
  ];
}

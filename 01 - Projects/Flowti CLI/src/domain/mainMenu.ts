/**
 * mainMenu.ts — Dynamic project detail menu for the Flowti CLI.
 *
 * Builds menu items from the project's flowti.config.json tool mappings,
 * package.json scripts, and static utilities. Submenu construction is
 * delegated to menu-builders.ts for readability.
 */

import { menu as makeMenu } from "./make/make.js";
import { componentListMenu } from "./make/component/component-list.js";
import { publishMenu } from "./publish/project-publish.js";
import { reviewMenu } from "./review/project-review.js";
import { showInfo } from "./info/info.js";
import { collectHealth, displayHealth } from "./health/health.js";
import { showHelp } from "./help/help.js";
import { captureIdea, captureNote } from "./capture/capture.js";
import { eventCatalogMenu } from "./events/events.js";
import {
  knowledgebaseMenu,
  isKnowledgebaseAvailable,
} from "./knowledgebase/knowledgebase.js";
import { buildWithReport } from "./reports/cli/generate-build-report.js";
import { getReportsDir } from "./project/project-config.js";
import { buildReportsSubmenu, buildDocsSubmenu, buildNpmScriptsSubmenu } from "./menu-builders.js";
import { getSelectedProject } from "../infrastructure/state.js";
import { initializeProject } from "./project/project-config.js";
import type { MenuEntry } from "../infrastructure/types.js";

// ── Public: build full menu for current project ─────────────────────

export function buildProjectDetailMenu(): MenuEntry[] {
  const projectName = getSelectedProject();
  if (!projectName) return buildFallbackMenu();

  const ctx = initializeProject(projectName);
  const hasScripts = Object.keys(ctx.scripts).length > 0;

  const items: MenuEntry[] = [];

  // ── Primary tools ─────────────────────────────────────────────────

  items.push({
    key: "1",
    label: "Make",
    action: () => makeMenu(ctx.path),
  });

  {
    const buildCmd = ctx.config.tools?.["build"];
    if (buildCmd) {
      items.push({
        key: "2",
        label: "Build",
        action: () => {
          buildWithReport(buildCmd, ctx.path);
          return "main" as const;
        },
      });
    } else {
      items.push({
        key: "2",
        label: "Build",
        action: () => "main" as const,
        disabled: true,
        disabledMessage:
          '\n  Build is not mapped. Add "build" to tools in flowti.config.json.\n',
      });
    }
  }

  items.push({
    key: "3",
    label: "Review",
    action: () => reviewMenu(ctx.path, ctx.config.review ?? {}),
  });

  items.push({
    key: "4",
    label: "Publish",
    action: () => publishMenu(ctx.path, ctx.config.publish ?? {}),
  });

  items.push({
    key: "c",
    label: "Components",
    action: () => componentListMenu(ctx.path, ctx.config.components),
  });

  items.push({
    key: "e",
    label: "Events",
    action: () => eventCatalogMenu(ctx.path),
  });

  items.push({ separator: true });

  // ── Reports submenu ───────────────────────────────────────────────

  items.push({
    key: "5",
    label: "Reports",
    action: async () => {
      const { runMenu } = await import("../infrastructure/menu.js");
      const generators = ctx.config.reports?.generators ?? [];
      const reportsDir = getReportsDir(ctx.path, ctx.config);
      await runMenu("reports", buildReportsSubmenu(generators, ctx.path, reportsDir));
      return "main" as const;
    },
  });

  // ── Npm Scripts submenu ───────────────────────────────────────────

  if (hasScripts) {
    items.push({
      key: "6",
      label: "Npm Scripts",
      action: async () => {
        const { runMenu } = await import("../infrastructure/menu.js");
        await runMenu("npm scripts", buildNpmScriptsSubmenu(ctx.path, ctx.scripts));
        return "main" as const;
      },
    });
  }

  items.push({ separator: true });

  // ── Utilities ─────────────────────────────────────────────────────

  items.push(
    { key: "7", label: "Capture Idea", action: captureIdea },
    { key: "8", label: "Capture Note", action: captureNote },
  );

  items.push({ separator: true });

  // ── Documentation submenu ─────────────────────────────────────────

  {
    const docsConfig = ctx.config.docs;
    items.push({
      key: "d",
      label: "Update Documentation",
      action: async () => {
        const { runMenu } = await import("../infrastructure/menu.js");
        const configGens = docsConfig?.generators ?? [];
        const allCmd = docsConfig?.allCommand;
        await runMenu("documentation", buildDocsSubmenu(configGens, allCmd, ctx.path), { defaultChoice: "1" });
        return "main" as const;
      },
    });
  }

  items.push(
    {
      key: "k",
      label: "Knowledgebase",
      action: knowledgebaseMenu,
      disabled: () => !isKnowledgebaseAvailable(),
      disabledMessage:
        "\n  Knowledgebase requires Obsidian CLI and an initialized vault.\n",
    },
    {
      key: "h",
      label: "Health",
      action: () => {
        const health = collectHealth(ctx);
        displayHealth(health);
        return "main" as const;
      },
    },
    {
      key: "i",
      label: "Info",
      action: () => {
        showInfo();
        return "main" as const;
      },
    },
  );

  items.push({ separator: true });

  // ── Navigation ────────────────────────────────────────────────────

  items.push(
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

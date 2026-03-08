/**
 * mainMenu.ts — Dynamic project detail menu for the Flowti CLI.
 *
 * Builds menu items from the project's flowti.config.json tool mappings,
 * package.json scripts, and static utilities.
 */

import { menu as makeMenu } from "./make/make.js";
import { componentListMenu } from "./make/component/component-list.js";
import { publishMenu } from "./publish/project-publish.js";
import { reviewMenu } from "./review/project-review.js";
import { showInfo } from "./info/info.js";
import { showHelp } from "./help/help.js";
import { captureIdea, captureNote } from "./capture/capture.js";
import { eventCatalogMenu } from "./events/event-catalog.js";
import {
  knowledgebaseMenu,
  isKnowledgebaseAvailable,
} from "./knowledgebase/knowledgebase.js";
import { buildWithReport } from "./reports/cli/generate-build-report.js";
import { runAllReports } from "./reports/report-runner.js";
import { runGenerator } from "./reports/generator-registry.js";
import { shell } from "../infrastructure/shell.js";
import { getSelectedProject } from "../infrastructure/state.js";
import { initializeProject } from "./project/project-config.js";
import type { MenuEntry } from "../infrastructure/types.js";

// ── Build script listing from package.json ──────────────────────────

function buildScriptItems(
  projectPath: string,
  scripts: Record<string, string>,
): MenuEntry[] {
  const names = Object.keys(scripts);
  if (names.length === 0) return [];

  return names.map((name, i) => ({
    key: String(i + 1),
    label: `npm run ${name}`,
    action: () => {
      shell.run(`npm run ${name}`, { cwd: projectPath, label: name });
      return "main" as const;
    },
  }));
}

// ── Public: build full menu for current project ─────────────────────

export function buildProjectDetailMenu(): MenuEntry[] {
  const projectName = getSelectedProject();
  if (!projectName) return buildFallbackMenu();

  const ctx = initializeProject(projectName);
  const scriptItems = buildScriptItems(ctx.path, ctx.scripts);

  const items: MenuEntry[] = [];

  // 1 — Make (always available)
  items.push({
    key: "1",
    label: "Make",
    action: () => makeMenu(ctx.path),
  });

  // 2 — Build (with Build Report)
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

  // 3 — Review (always available)
  items.push({
    key: "3",
    label: "Review",
    action: () => reviewMenu(ctx.path, ctx.config.review ?? {}),
  });

  // 4 — Publish (always available)
  items.push({
    key: "4",
    label: "Publish",
    action: () => publishMenu(ctx.path, ctx.config.publish ?? {}),
  });

  // c — Components (browse project components)
  items.push({
    key: "c",
    label: "Components",
    action: () => componentListMenu(ctx.path),
  });

  // e — Events (event catalog)
  items.push({
    key: "e",
    label: "Events",
    action: () => eventCatalogMenu(ctx.path),
  });

  items.push({ separator: true });

  // 5 — Reports (submenu)
  items.push({
    key: "5",
    label: "Reports",
    action: async () => {
      const { runMenu } = await import("../infrastructure/menu.js");
      const reportMenuItems: MenuEntry[] = [];
      const generators = ctx.config.reports?.generators ?? [];

      // "Run All" — runs each generator resiliently, never stops on failure
      if (generators.length > 0) {
        reportMenuItems.push({
          key: "1",
          label: "Run All Reports",
          action: () => {
            runAllReports(generators, ctx.path);
            return "main" as const;
          },
        });
      }

      // Individual generators
      const offset = generators.length > 0 ? 2 : 1;
      for (let i = 0; i < generators.length; i++) {
        const gen = generators[i];
        reportMenuItems.push({
          key: String(i + offset),
          label: gen.label,
          action: () => {
            if (gen.id) {
              runGenerator(gen.id, ctx.path);
            } else if (gen.command) {
              shell.run(gen.command, { cwd: ctx.path, label: gen.label });
            }
            return "main" as const;
          },
        });
      }

      reportMenuItems.push(
        { separator: true },
        { key: "b", label: "Back", action: () => "main" as const },
      );

      await runMenu("reports", reportMenuItems);
      return "main" as const;
    },
  });

  // 6 — Npm Scripts
  if (scriptItems.length > 0) {
    items.push({
      key: "6",
      label: "Npm Scripts",
      action: async () => {
        const { runMenu } = await import("../infrastructure/menu.js");
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

  // Project-level utilities
  items.push(
    { key: "7", label: "Capture Idea", action: captureIdea },
    { key: "8", label: "Capture Note", action: captureNote },
  );

  items.push({ separator: true });

  // d — Update Documentation
  {
    const docsConfig = ctx.config.docs;
    const generators = docsConfig?.generators ?? [];
    const allCmd = docsConfig?.allCommand;
    const hasAny = generators.length > 0 || !!allCmd;

    if (hasAny) {
      items.push({
        key: "d",
        label: "Update Documentation",
        action: async () => {
          const { runMenu } = await import("../infrastructure/menu.js");
          const docsMenuItems: MenuEntry[] = [];

          if (allCmd) {
            docsMenuItems.push({
              key: "1",
              label: "Generate All",
              action: () => {
                shell.run(allCmd, { cwd: ctx.path, label: "Documentation" });
                return "main" as const;
              },
            });
          }

          for (let i = 0; i < generators.length; i++) {
            const gen = generators[i];
            docsMenuItems.push({
              key: String(allCmd ? i + 2 : i + 1),
              label: gen.label,
              action: () => {
                shell.run(gen.command, { cwd: ctx.path, label: gen.label });
                return "main" as const;
              },
            });
          }

          docsMenuItems.push(
            { separator: true },
            { key: "b", label: "Back", action: () => "main" as const },
          );

          await runMenu("documentation", docsMenuItems);
          return "main" as const;
        },
      });
    } else {
      items.push({
        key: "d",
        label: "Update Documentation",
        action: () => "main" as const,
        disabled: true,
        disabledMessage:
          '\n  No documentation generators configured. Add "docs" to flowti.config.json.\n',
      });
    }
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
      key: "i",
      label: "Info",
      action: () => {
        showInfo();
        return "main" as const;
      },
    },
  );

  items.push({ separator: true });

  // Navigation
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

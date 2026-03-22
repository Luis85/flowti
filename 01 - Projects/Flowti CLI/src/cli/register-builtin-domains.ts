/**
 * register-builtin-domains.ts — Registers all built-in CLI commands on a CommandRegistry.
 *
 * Used by main.ts (runtime) and by docs:cli-surface (introspection). Plugin commands
 * are registered separately in main after project resolution.
 */

import { commands as helpCmds } from "../controller/help.controller.js";
import { commands as infoCmds } from "../controller/info.controller.js";
import { commands as buildCmds } from "../controller/build.controller.js";
import { commands as devToolsCmds } from "../controller/devtools.controller.js";
import { commands as makeCmds } from "../controller/make.controller.js";
import { commands as reviewCmds } from "../controller/review.controller.js";
import { commands as publishCmds } from "../controller/publish.controller.js";
import { commands as reportsCmds } from "../controller/reports.controller.js";
import { commands as captureCmds } from "../controller/capture.controller.js";
import { commands as healthCmds } from "../controller/health.controller.js";
import { commands as eventsCmds } from "../controller/events.controller.js";
import { commands as scaffoldCmds } from "../controller/scaffold.controller.js";
import { commands as resourcesCmds } from "../controller/resources.controller.js";
import { commands as timelogCmds } from "../controller/timelog.controller.js";
import { commands as deliverablesCmds } from "../controller/deliverables.controller.js";
import { commands as raidCmds } from "../controller/raid.controller.js";
import { commands as requirementsCmds } from "../controller/requirements.controller.js";
import { commands as capaCmds } from "../controller/capa.controller.js";
import { commands as lifecycleCmds } from "../controller/lifecycle.controller.js";
import { commands as projectCmds } from "../controller/project.controller.js";
import { createCommands as createProjectDepsCmds } from "../ui/displays/deps-display.js";
import { commands as pluginCmds } from "../controller/plugins.controller.js";
import { commands as aiToolsCmds } from "../controller/ai-tools.controller.js";
import { commands as sitemapCmds } from "../controller/sitemap.controller.js";
import { commands as claudeSyncCmds } from "../controller/claude-sync.controller.js";
import { commands as stateCmds } from "../controller/state.controller.js";
import { commands as workspaceCmds } from "../controller/workspace.controller.js";
import { commands as onboardingCmds } from "../controller/onboarding.controller.js";
import { commands as vaultTestCmds } from "../controller/vault-test.controller.js";
import { commands as storybookCmds } from "../controller/storybook.controller.js";
import { commands as agentCmds } from "../controller/agent.controller.js";
import { commands as taskCmds } from "../controller/task.controller.js";
import { commands as economyCmds } from "../controller/economy.controller.js";
import { commands as trustCmds } from "../controller/trust.controller.js";
import { commands as stagingCmds } from "../controller/staging.controller.js";
import { commands as vaultCmds } from "../controller/vault.controller.js";
import { commands as shopCmds } from "../controller/shop.controller.js";
import { commands as workerCmds } from "../controller/worker.controller.js";
import { commands as debugCmds } from "../controller/debug.controller.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { log } from "../infrastructure/logger.js";
import { CommandRegistry } from "../infrastructure/command-registry.js";
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import { generateCompletions } from "../infrastructure/completions.js";
import { docsCliSurfaceCommand } from "./docs-cli-surface-command.js";

/**
 * Register every built-in domain and wildcard handlers on `registry`.
 */
export function registerBuiltinDomains(registry: CommandRegistry): void {
	registry.registerDomain({ domain: "help", commands: helpCmds, projectFree: ["help"] });
	registry.registerDomain({
		domain: "completions",
		commands: {
			completions: adaptDescriptor({
				rawArgs: true,
				handler: (ctx) => {
					const shellName = ctx.rawArgs?.[1] ?? "bash";
					const script = generateCompletions(shellName, registry.keys());
					return { script, shellName };
				},
				renderer: (data, renderLog) => {
					if (data.script) {
						renderLog(data.script);
					} else {
						renderLog(`Unknown shell: ${data.shellName}. Supported: bash, zsh, fish, powershell`);
					}
				},
			}),
		},
		projectFree: ["completions"],
	});
	registry.registerDomain({ domain: "info", commands: infoCmds });
	registry.registerDomain({ domain: "build", commands: buildCmds });
	registry.registerDomain({
		domain: "devtools",
		commands: { ...devToolsCmds, "docs:cli-surface": docsCliSurfaceCommand },
		projectFree: ["docs:cli-surface"],
	});
	registry.registerDomain({ domain: "make", commands: makeCmds });
	registry.registerDomain({ domain: "review", commands: reviewCmds });
	registry.registerDomain({ domain: "publish", commands: publishCmds });
	registry.registerDomain({ domain: "reports", commands: reportsCmds });
	registry.registerDomain({
		domain: "capture",
		commands: captureCmds,
		projectFree: ["capture:idea", "capture:note", "capture:search", "capture:import"],
	});
	registry.registerDomain({ domain: "events", commands: eventsCmds });
	registry.registerDomain({ domain: "health", commands: healthCmds });
	registry.registerDomain({ domain: "resources", commands: resourcesCmds });
	registry.registerDomain({ domain: "timelog", commands: timelogCmds });
	registry.registerDomain({ domain: "deliverables", commands: deliverablesCmds });
	registry.registerDomain({ domain: "raid", commands: raidCmds });
	registry.registerDomain({ domain: "requirements", commands: requirementsCmds });
	registry.registerDomain({ domain: "capa", commands: capaCmds });
	registry.registerDomain({ domain: "lifecycle", commands: lifecycleCmds });
	registry.registerDomain({
		domain: "scaffold",
		commands: scaffoldCmds,
		projectFree: [
			"scaffold:new",
			"scaffold:list",
			"scaffold:marketplace",
			"marketplace:export",
			"marketplace:import-bundle",
		],
	});
	registry.registerDomain({
		domain: "project",
		commands: { ...projectCmds, ...createProjectDepsCmds({ disk, paths, log }) },
		projectFree: ["project", "project:deps"],
	});
	registry.registerDomain({
		domain: "plugins",
		commands: pluginCmds,
		projectFree: ["plugin:list", "plugin:validate", "plugin:new", "plugin:reference"],
	});
	registry.registerDomain({
		domain: "ai-tools",
		commands: aiToolsCmds,
		projectFree: ["ai:list", "ai:validate", "ai:new", "ai:reference", "ai:run"],
	});
	registry.registerDomain({
		domain: "sitemap",
		commands: sitemapCmds,
		projectFree: ["sitemap:validate", "sitemap:status", "sitemap:views"],
	});
	registry.registerDomain({
		domain: "claude",
		commands: claudeSyncCmds,
		projectFree: ["claude:sync"],
	});
	registry.registerDomain({ domain: "state", commands: stateCmds, projectFree: ["state"] });
	registry.registerDomain({
		domain: "onboarding",
		commands: onboardingCmds,
		projectFree: ["onboarding:status", "onboarding:start", "onboarding:skip", "onboarding:restart"],
	});
	registry.registerDomain({
		domain: "workspace",
		commands: workspaceCmds,
		projectFree: [
			"workspace:list",
			"workspace:inspect",
			"workspace:provision",
			"workspace:collect",
			"workspace:dispose",
			"workspace:prune",
		],
	});
	registry.registerDomain({
		domain: "vault-test",
		commands: vaultTestCmds,
		projectFree: ["test:vault", "test:vault:smoke", "test:vault:integration", "test:vault:ecosystem"],
	});
	registry.registerDomain({
		domain: "storybook",
		commands: storybookCmds,
		projectFree: ["storybook:scaffold"],
	});
	registry.registerDomain({
		domain: "agent",
		commands: agentCmds,
		projectFree: ["agent:list", "agent:task", "agent:wake", "agent:permission", "agent:dashboard-sync"],
	});
	registry.registerDomain({
		domain: "task",
		commands: taskCmds,
		projectFree: ["task:list", "task:create", "task:assign", "task:review", "task:approve", "task:reject", "task:standing-orders"],
	});
	registry.registerDomain({
		domain: "economy",
		commands: economyCmds,
		projectFree: ["economy:balance", "economy:ledger", "economy:grant"],
	});
	registry.registerDomain({
		domain: "trust",
		commands: trustCmds,
		projectFree: ["trust:show", "trust:promote", "trust:demote", "trust:history", "trust:reset"],
	});
	registry.registerDomain({
		domain: "staging",
		commands: stagingCmds,
		projectFree: ["staging:list", "staging:review", "staging:approve", "staging:reject"],
	});
	registry.registerDomain({
		domain: "vault",
		commands: vaultCmds,
		projectFree: ["vault:exec", "vault:context", "task:evaluate"],
	});
	registry.registerDomain({
		domain: "shop",
		commands: shopCmds,
		projectFree: ["shop:list", "shop:buy", "shop:catalog:add", "shop:catalog:edit"],
	});
	registry.registerDomain({
		domain: "worker",
		commands: workerCmds,
		projectFree: ["worker:status", "worker:queue", "worker:reassign", "worker:pause", "worker:resume"],
	});
	registry.registerDomain({
		domain: "debug",
		commands: debugCmds,
		projectFree: ["debug:set", "debug:trust", "debug:needs", "debug:unlock"],
	});
	registry.setWildcard("reports", reportsCmds["report:*"]);
	registry.setWildcardPrefix("report:");
}

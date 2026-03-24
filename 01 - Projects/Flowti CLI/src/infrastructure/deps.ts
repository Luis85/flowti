/**
 * deps.ts — Dependency injection container for the Flowti CLI.
 *
 * Defines the CliDeps interface (all injectable infrastructure) and
 * domain-specific subsets following the Interface Segregation Principle.
 * Production code uses createDefaultDeps(); tests use createTestDeps().
 */

import type { IFileSystem, IShell, IPaths, IClock, IProcess, IInput, IWorldStateManager, IWorkerManager, IAgentProcessRunner, IPidOps } from "./types.js";
import type { ICliBus } from "./event-bus.js";
import type { IAgentShell } from "../domain/agents/agent-shell.js";
import type { IProviderRegistry } from "../domain/agents/llm-types.js";
import { disk } from "./filesystem.js";
import { shell } from "./shell.js";
import { paths } from "./paths.js";
import { clock } from "./clock.js";
import { proc, pidOps } from "./proc.js";
import { input } from "./input.js";
import { log, warn } from "./logger.js";
import { createCliBus } from "./event-bus.js";
import { attachCliRenderer } from "../ui/renderers/cli-event-renderer.js";
import type { AgentsConfig, WorkspacesConfig } from "./types-config.js";
import { createWorldStateManager } from "./world-state-manager.js";
import { createProcessRunner } from "./agent-process-runner.js";
import { createWorkerManager } from "./worker-manager.js";
import { createProcessPool } from "../domain/agents/process-pool.js";
import { createAgentShell } from "./agent-shell.js";
import { createWorkspaceRegistry } from "./workspace-registry.js";
import { createWorkspaceProvisioner } from "./workspace-provisioner.js";
import { createStateSplitter } from "./state-splitter.js";
import { createStateCollector } from "./state-collector.js";
import { createProviderRegistry } from "./llm/provider-registry.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createCursorProvider } from "./llm/cursor-provider.js";
import { createOllamaProvider } from "./llm/ollama-provider.js";
import { createDispatcher } from "../domain/tasks/task-dispatcher.js";
import { agentStore } from "../domain/agents/agent-store.js";

// ── Full dependency container ───────────────────────────────────────

/** All injectable infrastructure dependencies. */
export interface CliDeps {
	readonly disk: IFileSystem;
	readonly shell: IShell;
	readonly paths: IPaths;
	readonly clock: IClock;
	readonly proc: IProcess;
	readonly pidOps: IPidOps;
	readonly input: IInput;
	readonly bus: ICliBus;
	readonly log: (msg?: string) => void;
	readonly warn: (msg: string) => void;
	readonly worldState: IWorldStateManager;
	readonly workerManager: IWorkerManager;
	readonly processRunner: IAgentProcessRunner;
	readonly providerRegistry?: IProviderRegistry;
	readonly agentShell?: IAgentShell;
	readonly dispatcher?: import("../domain/tasks/task-dispatcher.js").TaskDispatcher;
}

// ── Domain-specific subsets (ISP) ───────────────────────────────────

/** Dependencies for report generation. */
export type ReportDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

/** Dependencies for E2E orchestration. */
export type E2EDeps = Pick<CliDeps, "disk" | "shell" | "paths" | "clock" | "log" | "warn">;

/** Dependencies for Make/scaffold operations. */
export type MakeDeps = Pick<CliDeps, "disk" | "paths" | "input" | "log">;

/** Dependencies for devtools commands. */
export type DevToolsDeps = Pick<CliDeps, "shell" | "proc" | "log">;

/** Dependencies for interactive menu functions. */
export type MenuDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "input" | "log">;

/** Dependencies for shell-capable menu functions. */
export type ShellMenuDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "input" | "shell" | "log">;

/** Dependencies for dependency-graph display. */
export type DepsDeps = Pick<CliDeps, "disk" | "paths" | "log">;

/** Dependencies for info display. */
export type InfoDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "log">;

/** Dependencies for pipeline distribution. */
export type DistributeDeps = Pick<CliDeps, "disk" | "paths" | "log">;

/** Dependencies for start menu handlers. */
export type StartDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "input" | "log">;

/** Dependencies for action reference menus. */
export type ActionRefDeps = Pick<CliDeps, "disk" | "paths" | "input" | "log">;

/** Dependencies for component editor menus. */
export type EditorMenuDeps = Pick<CliDeps, "disk" | "paths" | "input" | "log">;

/** Dependencies for component product menus. */
export type ProductMenuDeps = Pick<CliDeps, "disk" | "paths" | "input" | "log">;

/** Dependencies for report archive menus. */
export type ArchiveDeps = Pick<CliDeps, "disk" | "paths" | "log">;

/** Dependencies for onboarding tour system. */
export type OnboardingDeps = Pick<CliDeps, "disk" | "paths" | "input" | "clock" | "log">;

/** Dependencies for workspace management. */
export type WorkspaceDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "bus" | "log">;

/** Deps for TUI action handlers — includes shell for effects, excludes input/log (no terminal I/O). */
export type TuiActionDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell">;

/** Dependencies for process registry operations. */
export type ProcessDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "pidOps">;

/** Log function type for renderers. */
export type Log = (msg?: string) => void;

// ── Factory ─────────────────────────────────────────────────────────

/** Create the production dependency container. */
export function createDefaultDeps(agentsConfig?: AgentsConfig, vaultRoot?: string): CliDeps {
	const bus = createCliBus();
	attachCliRenderer(bus);
	const resolvedRoot = vaultRoot ?? ".";
	const worldState = createWorldStateManager({ disk, paths, clock }, resolvedRoot);
	const baseDeps = { disk, shell, paths, clock, log };
	const providerRegistry = createProviderRegistry();
	providerRegistry.register(createClaudeProvider(baseDeps));
	if (shell.check?.("agent --version")) providerRegistry.register(createCursorProvider(baseDeps));
	providerRegistry.register(createOllamaProvider());
	const processRunner = createProcessRunner(baseDeps, agentsConfig, providerRegistry);
	const pool = createProcessPool(processRunner, { set: setTimeout, clear: clearTimeout }, {
		maxConcurrent: agentsConfig?.maxConcurrent ?? 2,
		processTimeoutMs: agentsConfig?.processTimeoutMs ?? 3_600_000,
	});
	const workerManager = createWorkerManager(baseDeps, worldState, processRunner, resolvedRoot, agentsConfig, pool);
	worldState.addActionListener((action) => workerManager.dispatchWorldEvent(action));

	// ── Task dispatcher (optional — only when agents are configured) ──
	let taskDispatcher: import("../domain/tasks/task-dispatcher.js").TaskDispatcher | undefined;
	if (agentsConfig) {
		const agentList = agentStore.list(baseDeps, resolvedRoot, agentsConfig.dir ? { dir: agentsConfig.dir } : undefined);
		const agentNames = agentList.map((a) => a.name);
		taskDispatcher = createDispatcher({
			clock,
			loadTrustProfile: () => null,
			getAgentCapabilities: () => [],
			getTaskHistory: () => [],
			getWorkerState: (name: string) => workerManager.getWorker(name)?.state ?? "stopped",
			updateTaskStatus: () => {},
			awardReward: () => {},
			emit: () => {},
			writeAgentEvent: () => {},
			sendToWorker: (name, msg, opts) => workerManager.send(name, msg, opts),
			schedule: (fn, ms) => { setTimeout(fn, ms); },
			cooldownMs: agentsConfig.decayTimeoutMs ?? 15000,
			maxRetries: 1,
		}, agentNames);
		workerManager.setDispatcher(taskDispatcher);
	}

	// Workspace-based agent shell (optional — only when workspacesConfig provided)
	const workspacesConfig = undefined as WorkspacesConfig | undefined;
	const agentShell = workspacesConfig ? createAgentShell({
		registry: createWorkspaceRegistry({ disk }, paths.join(resolvedRoot, ".flowti", "var", "workspace-registry.json")),
		provisioner: createWorkspaceProvisioner({ shell, disk, paths }, resolvedRoot),
		splitter: createStateSplitter({ disk, paths, shell }, resolvedRoot),
		collector: createStateCollector({ disk, paths, shell }, resolvedRoot),
		processRunner,
		agentFinder: () => null,
		config: workspacesConfig,
		clock,
		bus,
		worldState,
	}) : undefined;

	return { disk, shell, paths, clock, proc, pidOps, input, bus, log, warn, worldState, workerManager, processRunner, providerRegistry, agentShell, dispatcher: taskDispatcher };
}

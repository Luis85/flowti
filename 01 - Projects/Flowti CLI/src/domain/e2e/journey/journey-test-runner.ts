/**
 * journey-test-runner.ts — Vitest integration for journey definitions.
 *
 * Provides helpers to load journey files and execute them as vitest tests.
 * Supports environment resolution: the journey declares `requires.target`,
 * the runner resolves the matching EnvironmentProvider and assembles
 * the tool registry — dependency injection for test environments.
 *
 * Usage in a test file:
 *
 *   import { loadJourney, runStep, runJourney } from "../../src/domain/e2e/journey/index.js";
 *
 *   const journey = loadJourney(import.meta.dirname, "getting-started");
 *
 *   describe(`Journey: ${journey.journey}`, () => {
 *     for (const step of journey.steps) {
 *       it(step.title, async () => {
 *         const result = await runStep(step);
 *         expect(result.status).toBe("pass");
 *       });
 *     }
 *   });
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type {
	JourneyDefinition,
	JourneyStep,
	StepResult,
	JourneyResult,
	JourneyExecutorOptions,
} from "./journey-types.js";
import type { ToolDeps, ResolvedEnvironment } from "./journey-executor.js";
import { executeJourney, resolveEnvironment } from "./journey-executor.js";
import { loadJourneyFile } from "./journey-loader.js";
import { createDefaultRegistry } from "./providers/index.js";
import type { EnvironmentRegistry } from "./journey-environment.js";

// ── Default deps (using infrastructure wrappers) ─────────────────────

export function createDefaultDeps(deps: Pick<CliDeps, "disk" | "paths" | "proc" | "shell">, logger: (msg: string) => void = () => {}): ToolDeps {
	const { disk, paths, proc, shell } = deps;
	return {
		exec(cmd, execOpts) {
			return shell.runCaptureDetailed(cmd, {
				cwd: execOpts?.cwd,
				timeout: execOpts?.timeout ?? 30000,
				env: execOpts?.env ? { ...proc.env(), ...execOpts.env } as Record<string, string> : undefined,
			});
		},
		readFile: (filePath) => disk.readFileSync(filePath, "utf-8"),
		writeFile: (filePath, content) => {
			disk.mkdirSync(paths.dirname(filePath), { recursive: true });
			disk.writeFileSync(filePath, content, "utf-8");
		},
		exists: (filePath) => disk.existsSync(filePath),
		mkdir: (dirPath) => disk.mkdirSync(dirPath, { recursive: true }),
		log: (msg) => logger(msg),
		sleep: (waitMs) => new Promise((resolve) => setTimeout(resolve, waitMs)),
	};
}

// ── Journey loading ─────────────────────────────────────────────────

/**
 * Load a journey definition by slug relative to a base directory.
 * Looks for `{baseDir}/journeys/{slug}.journey`.
 */
export function loadJourney(baseDir: string, slug: string, deps: Pick<CliDeps, "disk" | "paths">): JourneyDefinition {
	const { disk, paths } = deps;
	const filePath = paths.join(baseDir, "journeys", `${slug}.journey`);
	return loadJourneyFile((p) => disk.readFileSync(p, "utf-8"), filePath);
}

/**
 * Load a journey definition from an absolute path.
 */
export function loadJourneyFromPath(filePath: string, deps: Pick<CliDeps, "disk">): JourneyDefinition {
	return loadJourneyFile((p) => deps.disk.readFileSync(p, "utf-8"), filePath);
}

// ── Environment resolution ──────────────────────────────────────────

/**
 * Resolve the execution environment for a journey definition.
 * Reads `requires.target` from the definition and looks up the matching
 * EnvironmentProvider in the registry. Returns a ResolvedEnvironment
 * with the merged tool registry and lifecycle hooks.
 */
export function resolveJourneyEnvironment(
	definition: JourneyDefinition,
	registry?: EnvironmentRegistry,
): ResolvedEnvironment {
	const target = definition.requires?.target;
	if (!target) return resolveEnvironment();

	const reg = registry ?? createDefaultRegistry();
	const provider = reg.getProvider(target);
	return resolveEnvironment(provider);
}

// ── Step execution ──────────────────────────────────────────────────

/** Shared deps instance (lazy-initialized). */
let _deps: ToolDeps | null = null;

function getDeps(): ToolDeps {
	if (!_deps) throw new Error("Tool deps not initialized. Call setToolDeps() before running steps.");
	return _deps;
}

/** Override the default tool dependencies (for testing). */
export function setToolDeps(deps: ToolDeps): void {
	_deps = deps;
}

/** Reset to default tool dependencies. */
export function resetToolDeps(): void {
	_deps = null;
}

/**
 * Execute a single journey step and return the result.
 * Use within a vitest `it()` block.
 */
export async function runStep(
	step: JourneyStep,
	opts: JourneyExecutorOptions = {},
	env?: ResolvedEnvironment,
): Promise<StepResult> {
	const deps = getDeps();
	const miniJourney: JourneyDefinition = {
		journey: `step:${step.id}`,
		description: step.description,
		steps: [step],
	};
	const result = await executeJourney(miniJourney, deps, opts, env);
	return result.steps[0];
}

/**
 * Execute an entire journey and return the full result.
 * Automatically resolves the environment from the journey's `requires` block.
 */
export async function runJourney(
	definition: JourneyDefinition,
	opts: JourneyExecutorOptions = {},
	registry?: EnvironmentRegistry,
): Promise<JourneyResult> {
	const env = resolveJourneyEnvironment(definition, registry);
	return executeJourney(definition, getDeps(), opts, env);
}

/**
 * Create a test-vault directory if it doesn't exist.
 * Returns the path to the test vault.
 */
export function ensureTestVault(projectRoot: string, vaultName: string = "test-vault", deps: Pick<CliDeps, "disk" | "paths">): string {
	const { disk, paths } = deps;
	const vaultPath = paths.join(projectRoot, "..", vaultName);
	if (!disk.existsSync(vaultPath)) {
		disk.mkdirSync(vaultPath, { recursive: true });
		disk.mkdirSync(paths.join(vaultPath, ".obsidian"), { recursive: true });
	}
	return vaultPath;
}

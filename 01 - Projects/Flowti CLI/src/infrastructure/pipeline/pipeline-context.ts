/**
 * pipeline-context.ts — Per-run state container for pipeline execution.
 *
 * Each pipeline run creates a fresh context instance. Steps read
 * accumulated results and command outputs through this object.
 * No module-level singletons — fully injectable and testable.
 */

import type { PipelineContext, StepResult } from "./pipeline-types.js";
import type { CliDeps } from "../deps.js";

export class PipelineContextImpl implements PipelineContext {
	private readonly results: StepResult[] = [];
	private readonly commandOutputs = new Map<string, string>();
	private readonly stepDataMap = new Map<string, Record<string, unknown>>();
	private readonly logFn: (message: string) => void;

	readonly projectPath: string;
	readonly deps: CliDeps;

	constructor(projectPath: string, deps: CliDeps, logFn: (message: string) => void = () => {}) {
		this.projectPath = projectPath;
		this.deps = deps;
		this.logFn = logFn;
	}

	log(message: string): void {
		this.logFn(message);
	}

	pushResult(result: StepResult): void {
		this.results.push(result);
	}

	getResults(): readonly StepResult[] {
		return this.results;
	}

	getStepResult(id: string): StepResult | undefined {
		return this.results.find((r) => r.id === id);
	}

	setCommandOutput(command: string, output: string): void {
		this.commandOutputs.set(command, output);
	}

	getCommandOutput(command: string): string | undefined {
		return this.commandOutputs.get(command);
	}

	setStepData(stepId: string, data: Record<string, unknown>): void {
		this.stepDataMap.set(stepId, data);
	}

	getStepData(stepId: string): Record<string, unknown> | undefined {
		return this.stepDataMap.get(stepId);
	}
}

/** Create a fresh pipeline context for a run. */
export function createPipelineContext(projectPath: string, deps: CliDeps, logFn?: (message: string) => void): PipelineContext {
	return new PipelineContextImpl(projectPath, deps, logFn);
}

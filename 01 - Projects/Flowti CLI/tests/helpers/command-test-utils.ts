// tests/helpers/command-test-utils.ts
import type { CommandContext } from "../../src/infrastructure/command-engine.js";
import type { CliDeps } from "../../src/infrastructure/deps.js";
import type { ProjectContext } from "../../src/infrastructure/types-config.js";
import { createTestDeps } from "../mocks/mock-deps.js";
import { ProjectFactory } from "./project-factory.js";

/** Build a minimal CommandContext for testing handler functions directly. */
export function createCommandContext<TFlags = Record<string, unknown>>(overrides?: {
	command?: string;
	flags?: TFlags;
	rawArgs?: string[];
	project?: ProjectContext;
	deps?: CliDeps;
	wildcard?: string;
}): CommandContext<TFlags> {
	return {
		command: overrides?.command ?? "test:cmd",
		flags: overrides?.flags ?? ({} as TFlags),
		rawArgs: overrides?.rawArgs,
		project: overrides?.project,
		deps: overrides?.deps ?? createTestDeps(),
		wildcard: overrides?.wildcard,
	};
}

/** Build a CommandContext with a default project. */
export function createProjectContext<TFlags = Record<string, unknown>>(overrides?: {
	command?: string;
	flags?: TFlags;
	rawArgs?: string[];
	project?: Partial<ProjectContext>;
	deps?: CliDeps;
}): CommandContext<TFlags> {
	return createCommandContext({
		...overrides,
		project: ProjectFactory.default(overrides?.project),
	});
}

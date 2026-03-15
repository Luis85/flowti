// tests/helpers/project-factory.ts
import type { ProjectContext } from "../../src/infrastructure/types-config.js";
import type { ProjectConfig } from "../../src/infrastructure/types-config.js";

export const ProjectFactory = {
	default: (overrides?: Partial<ProjectContext>): ProjectContext => ({
		path: "/project",
		config: { name: "test-project", reports: { generators: [] } } as ProjectConfig,
		scripts: {},
		pkg: { name: "test-project", version: "1.0.0" },
		...overrides,
	}),
	withConfig: (config: Partial<ProjectConfig>): ProjectContext =>
		ProjectFactory.default({ config: { name: "test", ...config } as ProjectConfig }),
	withScripts: (scripts: Record<string, string>): ProjectContext =>
		ProjectFactory.default({ scripts, pkg: { name: "test", version: "1.0.0", scripts } }),
};

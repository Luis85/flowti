import { describe, it, expectTypeOf } from "vitest";
import type {
	StorybookStatus, ProjectSummary, ProjectDetail,
	StorybookFramework, IProjectService,
} from "../../../src/domain/projects/types";

describe("project domain types", () => {
	it("StorybookStatus has required fields", () => {
		const status: StorybookStatus = {
			installed: false, framework: null, running: false, url: null, pid: null,
		};
		expectTypeOf(status).toMatchTypeOf<StorybookStatus>();
	});

	it("ProjectSummary has required fields", () => {
		const summary: ProjectSummary = {
			name: "Flowti CLI", type: "typescript-cli", hasNote: true,
			storybook: { installed: false, framework: null, running: false, url: null, pid: null },
		};
		expectTypeOf(summary).toMatchTypeOf<ProjectSummary>();
	});

	it("ProjectDetail extends ProjectSummary", () => {
		const detail: ProjectDetail = {
			name: "Flowti CLI", type: "typescript-cli", hasNote: true,
			storybook: { installed: true, framework: "react", running: true, url: "http://localhost:6006", pid: 1234 },
			notePath: "01 - Projects/Flowti CLI/Flowti CLI.md",
			projectPath: "01 - Projects/Flowti CLI",
		};
		expectTypeOf(detail).toMatchTypeOf<ProjectDetail>();
		expectTypeOf(detail).toMatchTypeOf<ProjectSummary>();
	});

	it("StorybookFramework is a string union", () => {
		const frameworks: StorybookFramework[] = ["html-vite", "react", "vue", "angular"];
		expectTypeOf(frameworks).toMatchTypeOf<StorybookFramework[]>();
	});

	it("IProjectService has async methods", () => {
		expectTypeOf<IProjectService>().toHaveProperty("listProjects");
		expectTypeOf<IProjectService>().toHaveProperty("getProject");
		expectTypeOf<IProjectService>().toHaveProperty("installStorybook");
		expectTypeOf<IProjectService>().toHaveProperty("startStorybook");
		expectTypeOf<IProjectService>().toHaveProperty("stopStorybook");
		expectTypeOf<IProjectService>().toHaveProperty("buildStorybook");
		expectTypeOf<IProjectService>().toHaveProperty("scaffoldStorybook");
	});
});

import { describe, it, expectTypeOf } from "vitest";
import type {
	StorybookStatus, ProjectSummary, ProjectDetail, ProjectBrief,
	StorybookFramework, IProjectService, MarkdownSourceConfig, ProjectConfig,
} from "../../../src/domain/projects/types";

describe("project domain types", () => {
	it("StorybookStatus has required fields", () => {
		const status: StorybookStatus = {
			installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false,
		};
		expectTypeOf(status).toMatchTypeOf<StorybookStatus>();
	});

	it("ProjectSummary has required fields", () => {
		const summary: ProjectSummary = {
			name: "Flowti CLI", type: "typescript-cli", hasNote: true,
			storybook: { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false },
		};
		expectTypeOf(summary).toMatchTypeOf<ProjectSummary>();
	});

	it("ProjectDetail extends ProjectSummary", () => {
		const detail: ProjectDetail = {
			name: "Flowti CLI", type: "typescript-cli", hasNote: true,
			storybook: { installed: true, framework: "react", running: true, url: "http://localhost:6006", pid: 1234, hasStaticBuild: false },
			notePath: "01 - Projects/Flowti CLI/Flowti CLI.md",
			projectPath: "01 - Projects/Flowti CLI",
			hasSitemap: false,
			hasCanvas: false,
			canvasChanged: false,
		};
		expectTypeOf(detail).toMatchTypeOf<ProjectDetail>();
		expectTypeOf(detail).toMatchTypeOf<ProjectSummary>();
	});

	it("StorybookFramework is a string union", () => {
		const frameworks: StorybookFramework[] = ["html", "react", "vue3", "angular"];
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
		expectTypeOf<IProjectService>().toHaveProperty("saveMarkdownSourceConfig");
	});

	it("MarkdownSourceConfig has required shape", () => {
		expectTypeOf<MarkdownSourceConfig>().toHaveProperty("path");
		expectTypeOf<MarkdownSourceConfig>().toHaveProperty("strategy");
		expectTypeOf<MarkdownSourceConfig>().toHaveProperty("requiredFields");
	});

	it("ProjectConfig accepts optional markdownSource", () => {
		expectTypeOf<ProjectConfig>().toHaveProperty("markdownSource");
		expectTypeOf<ProjectConfig["markdownSource"]>().toMatchTypeOf<MarkdownSourceConfig | undefined>();
	});

	it("ProjectDetail has hasSitemap field", () => {
		expectTypeOf<ProjectDetail>().toHaveProperty("hasSitemap");
	});

	it("ProjectDetail has hasCanvas and canvasChanged fields", () => {
		expectTypeOf<ProjectDetail>().toHaveProperty("hasCanvas");
		expectTypeOf<ProjectDetail>().toHaveProperty("canvasChanged");
	});

	it("IProjectService has cleanStorybook method", () => {
		expectTypeOf<IProjectService>().toHaveProperty("cleanStorybook");
	});

	it("IProjectService has importCanvasSitemap method", () => {
		expectTypeOf<IProjectService>().toHaveProperty("importCanvasSitemap");
	});

	it("IProjectService has previewStorybook and stopPreview methods", () => {
		expectTypeOf<IProjectService>().toHaveProperty("previewStorybook");
		expectTypeOf<IProjectService>().toHaveProperty("stopPreview");
	});

	it("ProjectDetail has optional brief field", () => {
		expectTypeOf<ProjectDetail>().toHaveProperty("brief");
	});
});

import { describe, it, expect } from "vitest";
import { loadOnboardingTour } from "../../../src/tui/loaders/onboarding-tour-loader.js";
import type { LoaderContext } from "../../../src/tui/loaders/loader-types.js";

function createMockContext(files: Record<string, string>): LoaderContext {
	return {
		deps: {
			disk: {
				existsSync: (p: string) => p in files,
				readFileSync: (p: string) => files[p] ?? "",
				readdirSync: () => [],
				writeFileSync: () => {},
				mkdirSync: () => {},
				copyFileSync: () => {},
				rmSync: () => {},
				unlinkSync: () => {},
				statSync: () => ({ mtimeMs: 0 }),
			} as never,
			paths: {
				join: (...args: string[]) => args.join("/"),
				resolve: (...args: string[]) => args.join("/"),
				basename: (p: string) => p.split("/").pop() ?? p,
				dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
				relative: (a: string, b: string) => b,
				extname: (p: string) => "." + (p.split(".").pop() ?? ""),
				isAbsolute: () => true,
				sep: "/",
			} as never,
			clock: { iso: () => "2026-03-16T00:00:00Z", now: () => Date.now(), ms: () => 0, safeIso: () => "2026-03-16" } as never,
			shell: {} as never,
			log: () => {},
		},
		vaultRoot: "/vault",
		projectPath: "/vault/project",
		projectsDir: "/vault/01 - Projects",
		agentsConfig: undefined,
		params: { tourId: "project-manager" },
	};
}

const tourJson = JSON.stringify({
	id: "project-manager",
	name: "Project Manager",
	role: "project-manager",
	description: "Test tour",
	steps: [
		{ id: "welcome", type: "narrate", content: "steps/01-welcome.md" },
		{ id: "name-project", type: "prompt", content: "steps/02-name.md", field: "projectName", validation: "non-empty" },
		{ id: "done", type: "checkpoint", content: "steps/03-done.md", label: "Done" },
	],
});

const toursJson = JSON.stringify({ tours: [{ id: "project-manager", path: "tours/project-manager/tour.json" }] });

describe("loadOnboardingTour", () => {
	it("loads tour and returns first step when no progress", () => {
		const ctx = createMockContext({
			"/vault/project/configs/onboarding/tours.json": toursJson,
			"/vault/project/configs/onboarding/tours/project-manager/tour.json": tourJson,
			"/vault/project/configs/onboarding/tours/project-manager/steps/01-welcome.md": "---\nspeaker: Alice\n---\n\nWelcome!",
		});
		const result = loadOnboardingTour(ctx);
		expect(result.tour).toBeDefined();
		expect(result.stepIndex).toBe(0);
		expect(result.totalSteps).toBe(3);
		expect(result.stepResult?.kind).toBe("narrate");
		expect(result.error).toBeUndefined();
	});

	it("returns error when tour not found", () => {
		const ctx = createMockContext({
			"/vault/project/configs/onboarding/tours.json": JSON.stringify({ tours: [] }),
		});
		const result = loadOnboardingTour(ctx);
		expect(result.error).toContain("not found");
	});

	it("resumes from saved progress", () => {
		const progress = JSON.stringify({
			tourId: "project-manager",
			currentStepIndex: 1,
			completedSteps: ["welcome"],
			context: {},
			startedAt: "2026-03-16T00:00:00Z",
		});
		const ctx = createMockContext({
			"/vault/project/configs/onboarding/tours.json": toursJson,
			"/vault/project/configs/onboarding/tours/project-manager/tour.json": tourJson,
			"/vault/project/configs/onboarding/tours/project-manager/steps/02-name.md": "Enter project name:",
			"/vault/.flowti/var/onboarding-progress.json": progress,
		});
		const result = loadOnboardingTour(ctx);
		expect(result.stepIndex).toBe(1);
		expect(result.stepResult?.kind).toBe("prompt");
	});
});

import { describe, it, expect } from "vitest";
import {
	groupByDomain,
	generateCommandReference,
} from "../../../src/domain/docs/commandReferenceGenerator";
import type { CommandMetaInput } from "../../../src/domain/docs/commandReferenceGenerator";

const DATE = "2026-02-27T12:00:00.000Z";

const sampleCommands: CommandMetaInput[] = [
	{ id: "flowti:open-user-hub", label: "Open user hub", description: "Open the personal dashboard", domain: "hub", category: "view", icon: "home" },
	{ id: "flowti:quick-capture", label: "Quick capture", description: "Open quick capture modal", domain: "capture", category: "capture", icon: "pencil" },
	{ id: "flowti:add-idea", label: "Add idea", description: "Capture a new idea", domain: "capture", category: "capture", icon: "lightbulb" },
	{ id: "flowti:start-train", label: "Start train", description: "Begin a new train session", domain: "train", category: "action", icon: "brain", shortcut: "Mod+Shift+T" },
	{ id: "flowti:open-analytics-hub", label: "Open analytics hub", description: "Open analytics", domain: "analytics", category: "view", icon: "bar-chart-2" },
];

describe("groupByDomain", () => {
	it("groups commands by domain", () => {
		const groups = groupByDomain(sampleCommands);

		expect(groups.size).toBe(4);
		expect(groups.get("hub")).toHaveLength(1);
		expect(groups.get("capture")).toHaveLength(2);
		expect(groups.get("train")).toHaveLength(1);
		expect(groups.get("analytics")).toHaveLength(1);
	});

	it("sorts commands alphabetically within groups", () => {
		const groups = groupByDomain(sampleCommands);
		const capture = groups.get("capture")!;

		expect(capture[0].label).toBe("Add idea");
		expect(capture[1].label).toBe("Quick capture");
	});

	it("returns empty map for empty input", () => {
		const groups = groupByDomain([]);
		expect(groups.size).toBe(0);
	});
});

describe("generateCommandReference", () => {
	it("includes frontmatter with correct counts", () => {
		const md = generateCommandReference(sampleCommands, DATE);

		expect(md).toContain("type: CommandReference");
		expect(md).toContain("total_commands: 5");
		expect(md).toContain("domains: 4");
	});

	it("includes summary callout", () => {
		const md = generateCommandReference(sampleCommands, DATE);

		expect(md).toContain("# Command Reference");
		expect(md).toContain("Total commands: 5");
		expect(md).toContain("Domains: 4");
	});

	it("groups commands by domain with headers", () => {
		const md = generateCommandReference(sampleCommands, DATE);

		expect(md).toContain("## Analytics");
		expect(md).toContain("## Capture");
		expect(md).toContain("## Hub");
		expect(md).toContain("## Train");
	});

	it("sorts domains alphabetically", () => {
		const md = generateCommandReference(sampleCommands, DATE);
		const analyticsIdx = md.indexOf("## Analytics");
		const captureIdx = md.indexOf("## Capture");
		const hubIdx = md.indexOf("## Hub");
		const trainIdx = md.indexOf("## Train");

		expect(analyticsIdx).toBeLessThan(captureIdx);
		expect(captureIdx).toBeLessThan(hubIdx);
		expect(hubIdx).toBeLessThan(trainIdx);
	});

	it("renders command table with all columns", () => {
		const md = generateCommandReference(sampleCommands, DATE);

		expect(md).toContain("| Command | Description | Category | Icon | Shortcut |");
		expect(md).toContain("| Open user hub | Open the personal dashboard | view | home |  |");
	});

	it("includes shortcut when present", () => {
		const md = generateCommandReference(sampleCommands, DATE);
		expect(md).toContain("| Start train | Begin a new train session | action | brain | Mod+Shift+T |");
	});

	it("handles commands without icon", () => {
		const commands: CommandMetaInput[] = [
			{ id: "test", label: "Test", description: "A test", domain: "dev", category: "action" },
		];
		const md = generateCommandReference(commands, DATE);
		expect(md).toContain("| Test | A test | action |  |  |");
	});

	it("handles empty command list", () => {
		const md = generateCommandReference([], DATE);

		expect(md).toContain("total_commands: 0");
		expect(md).toContain("domains: 0");
		expect(md).not.toContain("## ");
	});

	it("capitalizes domain headers", () => {
		const commands: CommandMetaInput[] = [
			{ id: "test", label: "Test", description: "Test", domain: "data-exchange", category: "action" },
		];
		const md = generateCommandReference(commands, DATE);
		expect(md).toContain("## Data-exchange");
	});

	it("includes date in frontmatter", () => {
		const md = generateCommandReference(sampleCommands, DATE);
		expect(md).toContain(`date: "${DATE}"`);
	});
});

import { describe, it, expect, vi } from "vitest";
import { scaffoldDefinition } from "../../../../src/domain/make/component/definition-scaffold.js";

function makeDeps() {
	const files = new Map<string, string>();
	return {
		disk: {
			existsSync: (p: string) => files.has(p.replace(/\\/g, "/")),
			writeFileSync: (p: string, content: string) => { files.set(p.replace(/\\/g, "/"), content); },
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...a: string[]) => a.join("/"),
			resolve: (...a: string[]) => a.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() || "",
			sep: "/",
		},
		files,
	};
}

describe("scaffoldDefinition", () => {
	it("returns error when name is missing", () => {
		const { disk, paths } = makeDeps();
		const result = scaffoldDefinition(undefined, {}, "/project", { disk, paths } as any);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("--name");
	});

	it("returns error when definition already exists", () => {
		const { disk, paths, files } = makeDeps();
		files.set("/project/components/definitions/my-widget.json", "{}");
		const result = scaffoldDefinition("my-widget", {}, "/project", { disk, paths } as any);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("already exists");
	});

	it("creates definition JSON successfully", () => {
		const { disk, paths, files } = makeDeps();
		const result = scaffoldDefinition("MyWidget", {}, "/project", { disk, paths } as any);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.id).toBe("my-widget");
			expect(result.outputPath).toContain("my-widget.json");
		}
		const written = files.get("/project/components/definitions/my-widget.json");
		expect(written).toBeTruthy();
		const parsed = JSON.parse(written!);
		expect(parsed.id).toBe("my-widget");
		expect(parsed.kind).toBe("component");
	});

	it("uses provided kind flag", () => {
		const { disk, paths, files } = makeDeps();
		scaffoldDefinition("ApiGateway", { kind: "system" }, "/project", { disk, paths } as any);
		const written = files.get("/project/components/definitions/api-gateway.json");
		const parsed = JSON.parse(written!);
		expect(parsed.kind).toBe("system");
	});

	it("uses provided label and description flags", () => {
		const { disk, paths, files } = makeDeps();
		scaffoldDefinition("Logger", { label: "Custom Logger", description: "A logging component" }, "/project", { disk, paths } as any);
		const written = files.get("/project/components/definitions/logger.json");
		const parsed = JSON.parse(written!);
		expect(parsed.label).toBe("Custom Logger");
		expect(parsed.description).toBe("A logging component");
	});

	it("creates definitions directory", () => {
		const { disk, paths } = makeDeps();
		scaffoldDefinition("Test", {}, "/project", { disk, paths } as any);
		expect(disk.mkdirSync).toHaveBeenCalledWith(
			"/project/components/definitions",
			{ recursive: true },
		);
	});
});

import { describe, it, expect, vi } from "vitest";
import type { IWorkspaceService } from "../../../src/infrastructure/services/WorkspaceService";

function createMockWorkspace(): IWorkspaceService {
	return {
		openFile: vi.fn(async () => {}),
		openFileInNewLeaf: vi.fn(async () => {}),
		openLink: vi.fn(async () => {}),
		openView: vi.fn(async () => {}),
	};
}

describe("IWorkspaceService (mock implementation)", () => {
	it("openFile calls through without error", async () => {
		const ws = createMockWorkspace();
		await ws.openFile("notes/hello.md");
		expect(ws.openFile).toHaveBeenCalledWith("notes/hello.md");
	});

	it("openFileInNewLeaf calls through without error", async () => {
		const ws = createMockWorkspace();
		await ws.openFileInNewLeaf("notes/hello.md");
		expect(ws.openFileInNewLeaf).toHaveBeenCalledWith("notes/hello.md");
	});

	it("openLink calls through without error", async () => {
		const ws = createMockWorkspace();
		await ws.openLink("Some Note");
		expect(ws.openLink).toHaveBeenCalledWith("Some Note");
	});

	it("openView calls through without error", async () => {
		const ws = createMockWorkspace();
		await ws.openView("flowti-catalog");
		expect(ws.openView).toHaveBeenCalledWith("flowti-catalog");
	});
});

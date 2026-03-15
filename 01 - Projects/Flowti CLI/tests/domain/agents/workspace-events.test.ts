import { describe, it, expect } from "vitest";
import type { WorkspaceEventMap } from "../../../src/domain/agents/workspace-events.js";

describe("WorkspaceEventMap", () => {
	it("defines all 8 workspace events", () => {
		const keys: (keyof WorkspaceEventMap)[] = [
			"workspace:provisioned",
			"workspace:ready",
			"workspace:active",
			"workspace:collecting",
			"workspace:disposed",
			"workspace:retained",
			"workspace:orphaned",
			"workspace:error",
		];
		expect(keys).toHaveLength(8);
	});

	it("provisioned payload includes method", () => {
		const payload: WorkspaceEventMap["workspace:provisioned"] = {
			workspace: {} as WorkspaceEventMap["workspace:provisioned"]["workspace"],
			method: "worktree",
		};
		expect(payload.method).toBe("worktree");
	});

	it("error payload includes error string", () => {
		const payload: WorkspaceEventMap["workspace:error"] = {
			workspace: {} as WorkspaceEventMap["workspace:error"]["workspace"],
			error: "disk full",
		};
		expect(payload.error).toBe("disk full");
	});
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderPermissionsTab } from "../../src/ui/permissions-tab.js";

function makeOptions() {
	return {
		grantPermission: vi.fn().mockResolvedValue({ ok: true }),
		baseUrl: "http://localhost:3000",
		pendingPermissions: [
			{ tool: "file_write", requestedAt: "2026-03-16T10:00:00Z" },
			{ tool: "shell_exec", requestedAt: "2026-03-16T10:05:00Z" },
		],
		grantHistory: [
			{ tool: "file_read", scope: "always" as const, grantedAt: "2026-03-16T09:00:00Z" },
			{ tool: "http_get", scope: "once" as const, grantedAt: "2026-03-16T09:30:00Z" },
		],
	};
}

describe("renderPermissionsTab", () => {
	it("renders pending permissions with Allow/Deny buttons", () => {
		const container = document.createElement("div");
		renderPermissionsTab(container, "TestBot", makeOptions());

		const items = container.querySelectorAll(".agent-panel-permission-item");
		expect(items.length).toBe(2);

		const allowBtns = container.querySelectorAll(".agent-panel-permission-allow");
		expect(allowBtns.length).toBe(2);

		const denyBtns = container.querySelectorAll(".agent-panel-permission-deny");
		expect(denyBtns.length).toBe(2);
	});

	it("renders tool names for pending permissions", () => {
		const container = document.createElement("div");
		renderPermissionsTab(container, "TestBot", makeOptions());

		const tools = container.querySelectorAll(".agent-panel-permission-tool");
		expect(tools[0].textContent).toBe("file_write");
		expect(tools[1].textContent).toBe("shell_exec");
	});

	it("Allow button fires callback with decision: allow", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderPermissionsTab(container, "TestBot", options);

		const allowBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-permission-allow");
		allowBtns[0].click();

		expect(options.grantPermission).toHaveBeenCalledWith(
			"http://localhost:3000",
			"TestBot",
			"file_write",
			"allow",
		);
	});

	it("Deny button fires callback with decision: deny", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderPermissionsTab(container, "TestBot", options);

		const denyBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-permission-deny");
		denyBtns[1].click();

		expect(options.grantPermission).toHaveBeenCalledWith(
			"http://localhost:3000",
			"TestBot",
			"shell_exec",
			"deny",
		);
	});

	it("renders grant history with tool name, scope, and timestamp", () => {
		const container = document.createElement("div");
		renderPermissionsTab(container, "TestBot", makeOptions());

		const grantItems = container.querySelectorAll(".agent-panel-grant-item");
		expect(grantItems.length).toBe(2);

		expect(grantItems[0].textContent).toContain("file_read");
		expect(grantItems[0].textContent).toContain("always");
		expect(grantItems[0].textContent).toContain("2026-03-16T09:00:00Z");

		expect(grantItems[1].textContent).toContain("http_get");
		expect(grantItems[1].textContent).toContain("once");
		expect(grantItems[1].textContent).toContain("2026-03-16T09:30:00Z");
	});

	it("shows Grant History title", () => {
		const container = document.createElement("div");
		renderPermissionsTab(container, "TestBot", makeOptions());

		const title = container.querySelector(".agent-panel-grant-title");
		expect(title?.textContent).toBe("Grant History");
	});

	it("shows empty message when no pending permissions", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		options.pendingPermissions = [];
		renderPermissionsTab(container, "TestBot", options);

		const empty = container.querySelector(".agent-panel-empty");
		expect(empty?.textContent).toBe("No pending permission requests.");
	});

	it("does not render grant history section when empty", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		options.grantHistory = [];
		renderPermissionsTab(container, "TestBot", options);

		const grantSection = container.querySelector(".agent-panel-grant-history");
		expect(grantSection).toBeNull();
	});
});

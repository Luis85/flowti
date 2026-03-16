// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/user/flowti-user-commands";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils";

interface CommandsEl extends HTMLElement {
	commands: unknown[];
	searchText: string;
	updateComplete: Promise<boolean>;
}

function makeCommand(overrides: Record<string, unknown> = {}) {
	return {
		id: "cmd-1",
		label: "Open Hub",
		description: "Opens the main hub view",
		domain: "hub",
		category: "navigation",
		icon: "home",
		...overrides,
	};
}

describe("flowti-user-commands", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-user-commands")).toBeDefined();
	});

	it("renders command items", async () => {
		const el = await fixture<CommandsEl>("flowti-user-commands", {
			commands: [makeCommand(), makeCommand({ id: "cmd-2", label: "Run Test" })],
			searchText: "",
		});

		const items = shadowQueryAll(el, ".command-item");
		expect(items.length).toBe(2);
	});

	it("filters commands by searchText", async () => {
		const el = await fixture<CommandsEl>("flowti-user-commands", {
			commands: [
				makeCommand({ label: "Open Hub" }),
				makeCommand({ id: "cmd-2", label: "Run Test" }),
			],
			searchText: "test",
		});

		const items = shadowQueryAll(el, ".command-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Run Test");
	});

	it("dispatches execute-command on item click", async () => {
		const el = await fixture<CommandsEl>("flowti-user-commands", {
			commands: [makeCommand()],
			searchText: "",
		});

		let detail: unknown = null;
		el.addEventListener("execute-command", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const item = shadowQuery(el, ".command-item");
		item?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(detail).toEqual({ commandId: "cmd-1" });
	});

	it("renders command detail with description", async () => {
		const el = await fixture<CommandsEl>("flowti-user-commands", {
			commands: [makeCommand({ label: "Open Hub", description: "Opens the main hub" })],
			searchText: "",
		});

		const items = shadowQueryAll(el, ".command-item");
		expect(items.length).toBe(1);
		const desc = shadowQuery(el, ".command-description");
		expect(desc).not.toBeNull();
		expect(desc!.textContent).toContain("Opens the main hub");
	});

	it("renders empty state when no commands", async () => {
		const el = await fixture<CommandsEl>("flowti-user-commands", {
			commands: [],
			searchText: "",
			isEmpty: true,
		});

		const empty = shadowQuery(el, ".flowti-empty");
		expect(empty).not.toBeNull();
	});

	it("renders domain badge on each command", async () => {
		const el = await fixture<CommandsEl>("flowti-user-commands", {
			commands: [makeCommand({ domain: "hub" })],
			searchText: "",
		});

		const badge = shadowQuery(el, ".command-domain");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toContain("hub");
	});
});

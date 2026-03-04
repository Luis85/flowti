// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { ChipList } from "../../../src/ui/journeyBuilder/ChipList";
import type { ChipListDeps } from "../../../src/ui/journeyBuilder/ChipList";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

function allByTestId(root: HTMLElement, id: string): HTMLElement[] {
	return Array.from(root.querySelectorAll(`[data-test-id="${id}"]`)) as HTMLElement[];
}

describe("ChipList", () => {
	let container: HTMLDivElement;
	let deps: ChipListDeps;

	beforeEach(() => {
		container = document.createElement("div");
		deps = {
			label: "Events",
			items: [],
			testIdPrefix: "jb-step-events",
			placeholder: "Add event…",
			onChanged: vi.fn(),
		};
	});

	// ── Rendering ──────────────────────────────────────────

	it("renders wrapper with correct test id", () => {
		new ChipList(container, deps).render();
		expect(byTestId(container, "jb-step-events-list")).toBeTruthy();
	});

	it("renders label header", () => {
		new ChipList(container, deps).render();
		const label = byTestId(container, "jb-step-events-label");
		expect(label).toBeTruthy();
		expect(label!.textContent).toBe("Events");
	});

	it("renders input with placeholder", () => {
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.placeholder).toBe("Add event…");
	});

	it("renders default placeholder when none provided", () => {
		deps.placeholder = undefined;
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		expect(input.placeholder).toBe("Add events…");
	});

	it("renders empty chip container when no items", () => {
		new ChipList(container, deps).render();
		const chips = allByTestId(container, "jb-step-events-chip");
		expect(chips).toHaveLength(0);
	});

	it("renders existing items as chips", () => {
		deps.items = ["user.login", "user.logout"];
		new ChipList(container, deps).render();
		const chips = allByTestId(container, "jb-step-events-chip");
		expect(chips).toHaveLength(2);
	});

	it("displays chip text content", () => {
		deps.items = ["user.login"];
		new ChipList(container, deps).render();
		const text = byTestId(container, "jb-step-events-chip-text");
		expect(text!.textContent).toBe("user.login");
	});

	it("renders remove button on each chip", () => {
		deps.items = ["a", "b"];
		new ChipList(container, deps).render();
		const removes = allByTestId(container, "jb-step-events-remove");
		expect(removes).toHaveLength(2);
		expect(removes[0].getAttribute("role")).toBe("button");
	});

	// ── Adding items ───────────────────────────────────────

	it("adds item on Enter key", () => {
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "user.login";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onChanged).toHaveBeenCalledWith(["user.login"]);
	});

	it("clears input after adding", () => {
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "user.login";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(input.value).toBe("");
	});

	it("renders new chip after adding", () => {
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "user.login";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		const chips = allByTestId(container, "jb-step-events-chip");
		expect(chips).toHaveLength(1);
	});

	it("ignores empty input on Enter", () => {
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "   ";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onChanged).not.toHaveBeenCalled();
	});

	it("ignores duplicate items", () => {
		deps.items = ["user.login"];
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "user.login";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onChanged).not.toHaveBeenCalled();
	});

	it("does not react to non-Enter keys", () => {
		new ChipList(container, deps).render();
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "test";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
		expect(deps.onChanged).not.toHaveBeenCalled();
	});

	// ── Removing items ─────────────────────────────────────

	it("removes item on click", () => {
		deps.items = ["a", "b", "c"];
		new ChipList(container, deps).render();
		const removes = allByTestId(container, "jb-step-events-remove");
		removes[1].click();
		expect(deps.onChanged).toHaveBeenCalledWith(["a", "c"]);
	});

	it("re-renders chips after remove", () => {
		deps.items = ["a", "b"];
		new ChipList(container, deps).render();
		allByTestId(container, "jb-step-events-remove")[0].click();
		const chips = allByTestId(container, "jb-step-events-chip");
		expect(chips).toHaveLength(1);
	});

	it("removes item on Enter keydown", () => {
		deps.items = ["x"];
		new ChipList(container, deps).render();
		const removeBtn = byTestId(container, "jb-step-events-remove")!;
		removeBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onChanged).toHaveBeenCalledWith([]);
	});

	it("removes item on Space keydown", () => {
		deps.items = ["x"];
		new ChipList(container, deps).render();
		const removeBtn = byTestId(container, "jb-step-events-remove")!;
		removeBtn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
		expect(deps.onChanged).toHaveBeenCalledWith([]);
	});

	// ── Isolation ──────────────────────────────────────────

	it("does not mutate original items array", () => {
		const original = ["a", "b"];
		deps.items = original;
		new ChipList(container, deps).render();
		// Add
		const input = byTestId(container, "jb-step-events-input") as HTMLInputElement;
		input.value = "c";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(original).toEqual(["a", "b"]);
	});

	it("works with different testIdPrefix", () => {
		deps.testIdPrefix = "jb-step-commands";
		deps.label = "Commands";
		deps.items = ["cmd.one"];
		new ChipList(container, deps).render();
		expect(byTestId(container, "jb-step-commands-list")).toBeTruthy();
		expect(byTestId(container, "jb-step-commands-chip")).toBeTruthy();
		expect(byTestId(container, "jb-step-commands-input")).toBeTruthy();
	});
});

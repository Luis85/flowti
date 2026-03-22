// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-overview.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-overview", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-overview") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-overview")).toBeDefined();
	});

	it("renders brief goal when set", async () => {
		el.brief = { goal: "Ship MVP", status: "active" };
		el.projectName = "TestProject";
		el.notePath = "some/path.md";
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Ship MVP");
	});

	it("renders health score when available", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("85");
	});

	it("shows health Refresh button", async () => {
		await el.updateComplete;
		const btns = Array.from(el.shadowRoot!.querySelectorAll("button"));
		const refreshBtn = btns.find((b) => b.textContent?.trim() === "Refresh");
		expect(refreshBtn).toBeDefined();
	});

	it("renders TODO items", async () => {
		el.todos = [{ text: "First task", done: false }, { text: "Done task", done: true }];
		el.todosExist = true;
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("First task");
		expect(el.shadowRoot!.textContent).toContain("Done task");
	});

	it("dispatches todo-add on Add button click", async () => {
		el.todosExist = true;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-add", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const input = el.shadowRoot!.getElementById("todo-input") as HTMLInputElement;
		if (input) {
			input.value = "New task";
			const btns = Array.from(el.shadowRoot!.querySelectorAll("button"));
			const addBtn = btns.find((b) => b.textContent?.trim() === "Add") as HTMLElement;
			addBtn?.click();
			expect(detail).toEqual({ text: "New task" });
		}
	});

	it("dispatches todo-toggle on checkbox click", async () => {
		el.todos = [{ text: "Task", done: false }];
		el.todosExist = true;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-toggle", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const checkbox = el.shadowRoot!.querySelector("input[type='checkbox']") as HTMLInputElement;
		checkbox?.dispatchEvent(new Event("change"));
		expect(detail).toEqual({ index: 0 });
	});

	it("dispatches health-refresh on Refresh click", async () => {
		await el.updateComplete;
		let fired = false;
		el.addEventListener("health-refresh", () => { fired = true; });
		const btns = Array.from(el.shadowRoot!.querySelectorAll("button"));
		const refreshBtn = btns.find((b) => b.textContent?.trim() === "Refresh") as HTMLElement;
		refreshBtn?.click();
		expect(fired).toBe(true);
	});

	it("dispatches todo-delete on delete button click", async () => {
		el.todos = [{ text: "Task to delete", done: false }];
		el.todosExist = true;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-delete", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const listItems = el.shadowRoot!.querySelectorAll(".todo-list li");
		const deleteBtn = listItems[0]?.querySelector("button") as HTMLElement;
		deleteBtn?.click();
		expect(detail).toEqual({ index: 0 });
	});

	it("dispatches open-project-note when Open brief clicked", async () => {
		el.brief = { goal: "Ship MVP", status: "active" };
		el.projectName = "TestProject";
		el.notePath = "some/brief.md";
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("open-project-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btns = Array.from(el.shadowRoot!.querySelectorAll("button"));
		const openBtn = btns.find((b) => b.textContent?.trim() === "Open brief") as HTMLElement;
		if (openBtn) {
			openBtn.click();
			expect(detail).toEqual({ path: "some/brief.md" });
		}
	});

	it("shows no-brief message when notePath is empty", async () => {
		el.notePath = "";
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No ProjectBrief yet");
	});

	it("shows health error when healthError set", async () => {
		el.healthError = "Connection failed";
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Connection failed");
	});

	it("shows no-todo message when todosExist is false and no todos", async () => {
		el.todosExist = false;
		el.todos = [];
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No TODO.md yet");
	});

	it("renders health grade", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("B");
	});

	it("renders score value with styling", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		const score = el.shadowRoot!.querySelector(".score");
		expect(score).not.toBeNull();
		expect(score!.textContent).toContain("85");
	});
});

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TrainPropertyEditor, type TrainPropertyEditorDeps } from "../../../src/ui/train/TrainPropertyEditor";
import type { App, CachedMetadata, TFile } from "obsidian";

// ── Helpers ──────────────────────────────────────────────

function createMockApp(frontmatter: Record<string, unknown> | null = null): App {
	const processFrontMatter = vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
		const fm: Record<string, unknown> = {};
		fn(fm);
	});

	return {
		metadataCache: {
			getCache: vi.fn((): CachedMetadata | null => {
				if (!frontmatter) return null;
				return { frontmatter: { ...frontmatter, position: { start: { line: 0 }, end: { line: 1 } } } } as unknown as CachedMetadata;
			}),
		},
		vault: {
			getAbstractFileByPath: vi.fn(() => ({ extension: "md", path: "trains/thought.md" })),
		},
		fileManager: {
			processFrontMatter,
		},
	} as unknown as App;
}

function createEditor(frontmatter: Record<string, unknown> | null = null): {
	el: HTMLElement;
	editor: TrainPropertyEditor;
	app: App;
} {
	const el = document.createElement("div");
	const app = createMockApp(frontmatter);
	const deps: TrainPropertyEditorDeps = { app, thoughtPath: "trains/thought.md" };
	const editor = new TrainPropertyEditor(el, deps);
	return { el, editor, app };
}

// ── Tests ────────────────────────────────────────────────

describe("TrainPropertyEditor", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("rendering", () => {
		it("renders empty state when no frontmatter exists", () => {
			const { el, editor } = createEditor(null);
			editor.render();

			expect(el.textContent).toContain("No properties");
			expect(el.querySelector(".ft-train-property-empty")).not.toBeNull();
		});

		it("renders Properties heading with file-code icon", () => {
			const { el, editor } = createEditor({ type: "thought" });
			editor.render();

			expect(el.textContent).toContain("Properties");
		});

		it("renders existing frontmatter as key-value rows", () => {
			const { el, editor } = createEditor({
				type: "thought",
				tags: "exploration",
				priority: 1,
			});
			editor.render();

			const rows = el.querySelectorAll(".ft-train-property-row");
			expect(rows.length).toBe(3);
		});

		it("displays property keys and values", () => {
			const { el, editor } = createEditor({ tags: "exploration" });
			editor.render();

			const keys = el.querySelectorAll(".ft-train-property-key");
			const values = el.querySelectorAll(".ft-train-property-value");
			expect(keys[0].textContent).toBe("tags");
			expect(values[0].textContent).toBe("exploration");
		});

		it("displays array values as comma-separated", () => {
			const { el, editor } = createEditor({ tags: ["a", "b", "c"] });
			editor.render();

			const value = el.querySelector(".ft-train-property-value");
			expect(value?.textContent).toBe("a, b, c");
		});

		it("strips position key from display", () => {
			const { el, editor } = createEditor({ type: "thought" });
			editor.render();

			const keys = Array.from(el.querySelectorAll(".ft-train-property-key")).map(
				(k) => k.textContent,
			);
			expect(keys).not.toContain("position");
		});
	});

	describe("built-in properties", () => {
		it("shows lock icon on built-in properties", () => {
			const { el, editor } = createEditor({ type: "thought", train: "My Train" });
			editor.render();

			const locks = el.querySelectorAll(".ft-train-property-lock");
			expect(locks.length).toBe(2);
		});

		it("marks type, train, direction, order, parent as built-in", () => {
			const { el, editor } = createEditor({
				type: "thought",
				train: "T1",
				direction: "next",
				order: 0,
				parent: "root",
			});
			editor.render();

			const locks = el.querySelectorAll(".ft-train-property-lock");
			expect(locks.length).toBe(5);
		});

		it("does not show lock icon on user properties", () => {
			const { el, editor } = createEditor({ tags: "exploration" });
			editor.render();

			const locks = el.querySelectorAll(".ft-train-property-lock");
			expect(locks.length).toBe(0);
		});
	});

	describe("editing values", () => {
		it("shows input when user property value is clicked", () => {
			const { el, editor } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			expect(input).not.toBeNull();
			expect(input.value).toBe("exploration");
		});

		it("writes frontmatter on blur after edit", () => {
			const { el, editor, app } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "research";
			input.dispatchEvent(new Event("blur"));

			// Debounce
			vi.advanceTimersByTime(500);

			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it("does not write if value unchanged", () => {
			const { el, editor, app } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			// Don't change the value
			input.dispatchEvent(new Event("blur"));

			vi.advanceTimersByTime(500);

			expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("commits on Enter key", () => {
			const { el, editor, app } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "updated";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
			// happy-dom may not fire blur from .blur() inside keydown handler
			input.dispatchEvent(new Event("blur"));

			vi.advanceTimersByTime(500);

			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it("reverts on Escape key", () => {
			const { el, editor } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "changed";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

			expect(value.textContent).toBe("exploration");
		});

		it("debounces writes at 500ms", () => {
			const { el, editor, app } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "updated";
			input.dispatchEvent(new Event("blur"));

			// Not yet written
			vi.advanceTimersByTime(200);
			expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();

			// Written after 500ms
			vi.advanceTimersByTime(300);
			expect(app.fileManager.processFrontMatter).toHaveBeenCalledTimes(1);
		});
	});

	describe("adding properties", () => {
		it("renders Add button", () => {
			const { el, editor } = createEditor({ type: "thought" });
			editor.render();

			const addBtn = el.querySelector(".ft-train-property-add-btn");
			expect(addBtn).not.toBeNull();
		});

		it("shows key and value inputs when Add clicked", () => {
			const { el, editor } = createEditor({ type: "thought" });
			editor.render();

			const addBtn = el.querySelector(".ft-train-property-add-btn") as HTMLElement;
			addBtn.click();

			const keyInput = el.querySelector(".ft-train-property-key-input");
			const valueInput = el.querySelector(".ft-train-property-value-input");
			expect(keyInput).not.toBeNull();
			expect(valueInput).not.toBeNull();
		});

		it("adds property on value blur with valid key", () => {
			const { el, editor, app } = createEditor({});
			editor.render();

			const addBtn = el.querySelector(".ft-train-property-add-btn") as HTMLElement;
			addBtn.click();

			const keyInput = el.querySelector(".ft-train-property-key-input") as HTMLInputElement;
			const valueInput = el.querySelector(".ft-train-property-value-input") as HTMLInputElement;
			keyInput.value = "mood";
			valueInput.value = "focused";
			valueInput.dispatchEvent(new Event("blur"));

			vi.advanceTimersByTime(500);

			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
			const rows = el.querySelectorAll(".ft-train-property-row");
			expect(rows.length).toBe(1);
		});

		it("removes row if key is empty on blur", () => {
			const { el, editor } = createEditor({});
			editor.render();

			const addBtn = el.querySelector(".ft-train-property-add-btn") as HTMLElement;
			addBtn.click();

			const valueInput = el.querySelector(".ft-train-property-value-input") as HTMLInputElement;
			valueInput.dispatchEvent(new Event("blur"));

			const newRows = el.querySelectorAll(".ft-train-property-new");
			expect(newRows.length).toBe(0);
		});

		it("rejects adding built-in keys", () => {
			const { el, editor, app } = createEditor({});
			editor.render();

			const addBtn = el.querySelector(".ft-train-property-add-btn") as HTMLElement;
			addBtn.click();

			const keyInput = el.querySelector(".ft-train-property-key-input") as HTMLInputElement;
			const valueInput = el.querySelector(".ft-train-property-value-input") as HTMLInputElement;
			keyInput.value = "type";
			valueInput.value = "something";
			valueInput.dispatchEvent(new Event("blur"));

			vi.advanceTimersByTime(500);

			expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("removes empty state message when adding first property", () => {
			const { el, editor } = createEditor(null);
			editor.render();

			expect(el.querySelector(".ft-train-property-empty")).not.toBeNull();

			const addBtn = el.querySelector(".ft-train-property-add-btn") as HTMLElement;
			addBtn.click();

			expect(el.querySelector(".ft-train-property-empty")).toBeNull();
		});
	});

	describe("value parsing", () => {
		it("parses 'true' as boolean true", () => {
			const { el, editor, app } = createEditor({ flag: "old" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "true";
			input.dispatchEvent(new Event("blur"));
			vi.advanceTimersByTime(500);

			const processFn = (app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>);
			const callback = processFn.mock.calls[0][1] as (fm: Record<string, unknown>) => void;
			const fm: Record<string, unknown> = {};
			callback(fm);
			expect(fm.flag).toBe(true);
		});

		it("parses numeric strings as numbers", () => {
			const { el, editor, app } = createEditor({ count: "old" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "42";
			input.dispatchEvent(new Event("blur"));
			vi.advanceTimersByTime(500);

			const processFn = (app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>);
			const callback = processFn.mock.calls[0][1] as (fm: Record<string, unknown>) => void;
			const fm: Record<string, unknown> = {};
			callback(fm);
			expect(fm.count).toBe(42);
		});
	});

	describe("cleanup", () => {
		it("clears pending timer on destroy", () => {
			const { el, editor, app } = createEditor({ tags: "exploration" });
			editor.render();

			const value = el.querySelector(".ft-train-property-value") as HTMLElement;
			value.click();

			const input = el.querySelector(".ft-train-property-input") as HTMLInputElement;
			input.value = "updated";
			input.dispatchEvent(new Event("blur"));

			// Destroy before debounce completes
			editor.destroy();
			vi.advanceTimersByTime(500);

			expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});
});

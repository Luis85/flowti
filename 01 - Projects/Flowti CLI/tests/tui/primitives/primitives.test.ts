import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { Badge } from "../../../src/tui/primitives/badge.js";
import { StatCard } from "../../../src/tui/primitives/stat-card.js";
import { StatGrid } from "../../../src/tui/primitives/stat-grid.js";
import { Section } from "../../../src/tui/primitives/section.js";
import { ActionBar } from "../../../src/tui/primitives/action-bar.js";
import { KeyHints } from "../../../src/tui/primitives/key-hints.js";
import { SearchInput } from "../../../src/tui/primitives/search-input.js";
import { ScrollableList } from "../../../src/tui/primitives/scrollable-list.js";
import { MasterDetail } from "../../../src/tui/primitives/master-detail.js";
import { FormField } from "../../../src/tui/primitives/form-field.js";

function frame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Badge", () => {
	it("renders text in brackets", () => {
		const inst = render(React.createElement(Badge, { text: "active" }));
		expect(frame(inst)).toContain("[active]");
		inst.unmount();
	});
});

describe("StatCard", () => {
	it("renders label and value", () => {
		const inst = render(React.createElement(StatCard, { label: "Tests", value: 42 }));
		const f = frame(inst);
		expect(f).toContain("Tests");
		expect(f).toContain("42");
		inst.unmount();
	});

	it("renders trend when provided", () => {
		const inst = render(React.createElement(StatCard, { label: "Coverage", value: "84%", trend: "+2%" }));
		expect(frame(inst)).toContain("+2%");
		inst.unmount();
	});
});

describe("StatGrid", () => {
	it("renders all stats", () => {
		const stats = [
			{ label: "Files", value: 100 },
			{ label: "Tests", value: 200 },
		];
		const inst = render(React.createElement(StatGrid, { stats }));
		const f = frame(inst);
		expect(f).toContain("Files");
		expect(f).toContain("Tests");
		inst.unmount();
	});
});

describe("Section", () => {
	it("renders title and children", () => {
		const inst = render(
			React.createElement(Section, { title: "Skills" },
				React.createElement(Text, null, "TDD"),
			),
		);
		const f = frame(inst);
		expect(f).toContain("Skills");
		expect(f).toContain("TDD");
		inst.unmount();
	});
});

describe("ActionBar", () => {
	it("renders action keys and labels", () => {
		const actions = [{ key: "n", label: "New" }, { key: "d", label: "Delete" }];
		const inst = render(React.createElement(ActionBar, { actions }));
		const f = frame(inst);
		expect(f).toContain("n");
		expect(f).toContain("New");
		expect(f).toContain("d");
		expect(f).toContain("Delete");
		inst.unmount();
	});

	it("renders nothing for empty actions", () => {
		const inst = render(React.createElement(ActionBar, { actions: [] }));
		expect(frame(inst)).toBe("");
		inst.unmount();
	});
});

describe("KeyHints", () => {
	it("renders hint keys and labels", () => {
		const hints = [{ key: "Enter", label: "Select" }];
		const inst = render(React.createElement(KeyHints, { hints }));
		expect(frame(inst)).toContain("Enter");
		expect(frame(inst)).toContain("Select");
		inst.unmount();
	});
});

describe("SearchInput", () => {
	it("renders filter text when active", () => {
		const inst = render(React.createElement(SearchInput, { value: "bob", onChange: () => {}, active: true }));
		expect(frame(inst)).toContain("bob");
		inst.unmount();
	});

	it("renders nothing when inactive", () => {
		const inst = render(React.createElement(SearchInput, { value: "", onChange: () => {}, active: false }));
		expect(frame(inst)).toBe("");
		inst.unmount();
	});
});

describe("ScrollableList", () => {
	it("renders items with selection indicator", () => {
		const items = ["Alice", "Bob", "Charlie"];
		const inst = render(
			React.createElement(ScrollableList, {
				items,
				selected: 1,
				renderItem: (item: string, _i: number, sel: boolean) => React.createElement(Text, { bold: sel }, item),
			}),
		);
		const f = frame(inst);
		expect(f).toContain("Bob");
		expect(f).toContain("\u25B6");
		inst.unmount();
	});

	it("renders empty state", () => {
		const inst = render(
			React.createElement(ScrollableList, {
				items: [],
				selected: 0,
				renderItem: () => React.createElement(Text, null, "x"),
			}),
		);
		expect(frame(inst)).toContain("No items");
		inst.unmount();
	});
});

describe("MasterDetail", () => {
	it("renders master and detail panes", () => {
		const inst = render(
			React.createElement(MasterDetail, {
				master: React.createElement(Text, null, "LIST"),
				detail: React.createElement(Text, null, "DETAIL"),
			}),
		);
		const f = frame(inst);
		expect(f).toContain("LIST");
		expect(f).toContain("DETAIL");
		inst.unmount();
	});

	it("renders without detail pane", () => {
		const inst = render(
			React.createElement(MasterDetail, {
				master: React.createElement(Text, null, "LIST"),
			}),
		);
		expect(frame(inst)).toContain("LIST");
		inst.unmount();
	});
});

describe("FormField", () => {
	it("renders text field with value", () => {
		const inst = render(React.createElement(FormField, { type: "text", label: "Name", value: "Bob" }));
		const f = frame(inst);
		expect(f).toContain("Name");
		expect(f).toContain("Bob");
		inst.unmount();
	});

	it("renders toggle field", () => {
		const inst = render(React.createElement(FormField, { type: "toggle", label: "Active", value: true }));
		expect(frame(inst)).toContain("Yes");
		inst.unmount();
	});

	it("renders select field", () => {
		const inst = render(React.createElement(FormField, { type: "select", label: "Type", value: "ai", options: ["ai", "human"] }));
		expect(frame(inst)).toContain("ai");
		inst.unmount();
	});

	it("renders error message", () => {
		const inst = render(React.createElement(FormField, { type: "text", label: "Name", value: "", error: "Required" }));
		expect(frame(inst)).toContain("Required");
		inst.unmount();
	});
});

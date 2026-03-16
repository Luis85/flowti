import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { Badge } from "../../../src/tui/primitives/badge.js";
import { StatCard } from "../../../src/tui/primitives/stat-card.js";
import { StatGrid } from "../../../src/tui/primitives/stat-grid.js";
import { Section } from "../../../src/tui/primitives/section.js";

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

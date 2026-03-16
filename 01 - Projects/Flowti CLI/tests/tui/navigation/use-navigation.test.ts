import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useNavigation } from "../../../src/tui/navigation/use-navigation.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";
import type { NavigationState } from "../../../src/tui/types.js";

interface HarnessActions {
	navigate: (pageId: string, params?: Record<string, string>) => void;
	goBack: () => void;
	setSection: (sectionId: string) => void;
}

const actionsRef: { current: HarnessActions | null } = { current: null };

function NavigationHarness(): React.JSX.Element {
	const sections = buildSections();
	const nav = useNavigation(sections);
	actionsRef.current = { navigate: nav.navigate, goBack: nav.goBack, setSection: nav.setSection };
	return React.createElement(Text, null, JSON.stringify(nav.state));
}

function parseState(frame: string | undefined): NavigationState {
	return JSON.parse(frame ?? "{}");
}

function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

describe("useNavigation", () => {
	it("starts at home section with start page", () => {
		const inst = render(React.createElement(NavigationHarness));
		const state = parseState(inst.lastFrame());
		expect(state.section).toBe("home");
		expect(state.pageStack).toEqual(["start"]);
		inst.unmount();
	});

	it("navigate pushes page onto stack", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("agents");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.pageStack).toEqual(["start", "agents"]);
		expect(state.section).toBe("agents");
		inst.unmount();
	});

	it("goBack pops the stack", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("agents");
		await flush();
		actionsRef.current!.goBack();
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.pageStack).toEqual(["start"]);
		expect(state.section).toBe("home");
		inst.unmount();
	});

	it("goBack at root does nothing", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.goBack();
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.pageStack).toEqual(["start"]);
		inst.unmount();
	});

	it("setSection resets stack to section root page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("agents");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		actionsRef.current!.setSection("reports");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.section).toBe("reports");
		expect(state.pageStack).toEqual(["reports"]);
		inst.unmount();
	});

	it("navigate passes params", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.params).toEqual({ name: "bob" });
		inst.unmount();
	});

	it("navigate auto-switches section when target is in different section", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("iterations");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.section).toBe("management");
		inst.unmount();
	});
});

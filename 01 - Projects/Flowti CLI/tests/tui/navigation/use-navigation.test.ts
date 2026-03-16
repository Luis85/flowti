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
const stateRef: { current: NavigationState | null } = { current: null };

function NavigationHarness(): React.JSX.Element {
	const sections = buildSections();
	const nav = useNavigation(sections);
	actionsRef.current = { navigate: nav.navigate, goBack: nav.goBack, setSection: nav.setSection };
	stateRef.current = nav.state;
	return React.createElement(Text, null, nav.state.activeSection);
}

function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

function state(): NavigationState {
	return stateRef.current!;
}

function activeStack(): readonly string[] {
	const s = state();
	return s.sections[s.activeSection].pageStack;
}

function activeParams(): Readonly<Record<string, string>> {
	const s = state();
	return s.sections[s.activeSection].params;
}

describe("useNavigation", () => {
	it("starts at home section with start page", () => {
		const inst = render(React.createElement(NavigationHarness));
		expect(state().activeSection).toBe("home");
		expect(activeStack()).toEqual(["start"]);
		inst.unmount();
	});

	it("navigate cross-section replaces target stack with page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("ai-tools");
		await flush();
		expect(activeStack()).toEqual(["ai-tools"]);
		expect(state().activeSection).toBe("agents");
		inst.unmount();
	});

	it("navigate passes params", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		expect(activeParams()).toEqual({ name: "bob" });
		inst.unmount();
	});

	it("goBack pops the stack", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("ai-tools");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		actionsRef.current!.goBack();
		await flush();
		expect(activeStack()).toEqual(["ai-tools"]);
		expect(state().activeSection).toBe("agents");
		inst.unmount();
	});

	it("goBack at root returns atRoot flag", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.goBack();
		await flush();
		expect(activeStack()).toEqual(["start"]);
		inst.unmount();
	});

	it("setSection switches and initializes landing page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.setSection("reports");
		await flush();
		expect(state().activeSection).toBe("reports");
		expect(activeStack()).toEqual(["reports"]);
		inst.unmount();
	});

	it("setSection preserves previous section state", async () => {
		const inst = render(React.createElement(NavigationHarness));
		// Navigate deep into agents
		actionsRef.current!.navigate("ai-tools");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		// Switch to reports
		actionsRef.current!.setSection("reports");
		await flush();
		// Switch back to agents — should resume where we left off
		actionsRef.current!.setSection("agents");
		await flush();
		expect(state().activeSection).toBe("agents");
		expect(activeStack()).toEqual(["ai-tools", "agent-detail"]);
		expect(activeParams()).toEqual({ name: "bob" });
		inst.unmount();
	});

	it("navigate within same section pushes onto stack", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.setSection("agents");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "alice" });
		await flush();
		expect(activeStack()).toEqual(["ai-tools", "agent-detail"]);
		expect(activeParams()).toEqual({ name: "alice" });
		inst.unmount();
	});

	it("navigate auto-switches section for cross-section targets", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("iterations");
		await flush();
		expect(state().activeSection).toBe("management");
		expect(activeStack()).toEqual(["iterations"]);
		inst.unmount();
	});

	it("setSection to same section resets to landing page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("ai-tools");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		// Re-select same section → resets
		actionsRef.current!.setSection("agents");
		await flush();
		expect(activeStack()).toEqual(["ai-tools"]);
		inst.unmount();
	});
});

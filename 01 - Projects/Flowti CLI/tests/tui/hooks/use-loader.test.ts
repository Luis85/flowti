import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useLoader } from "../../../src/tui/hooks/use-loader.js";
import type { LoaderContext, LoaderFn } from "../../../src/tui/loaders/loader-types.js";

interface TestData { items: string[] }

const mockCtx: LoaderContext = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	params: {},
	agentsConfig: undefined,
};

function LoaderHarness({ loader, ctx, resultRef }: {
	loader: LoaderFn<TestData>;
	ctx: LoaderContext;
	resultRef: React.MutableRefObject<ReturnType<typeof useLoader<TestData>> | null>;
}): React.JSX.Element {
	const result = useLoader(loader, ctx);
	resultRef.current = result;
	return React.createElement(Text, null, result.data ? JSON.stringify(result.data) : result.error ?? "loading");
}

function renderLoader(loader: LoaderFn<TestData>, ctx = mockCtx) {
	const resultRef: React.MutableRefObject<ReturnType<typeof useLoader<TestData>> | null> = { current: null };
	const instance = render(React.createElement(LoaderHarness, { loader, ctx, resultRef }));
	return { ...instance, result: () => resultRef.current! };
}

describe("useLoader", () => {
	it("returns data from successful loader", () => {
		const loader: LoaderFn<TestData> = () => ({ items: ["a", "b"] });
		const { unmount, result } = renderLoader(loader);
		expect(result().data).toEqual({ items: ["a", "b"] });
		expect(result().loading).toBe(false);
		expect(result().error).toBeNull();
		unmount();
	});

	it("returns error when loader throws", () => {
		const loader: LoaderFn<TestData> = () => { throw new Error("fail"); };
		const { unmount, result } = renderLoader(loader);
		expect(result().data).toBeNull();
		expect(result().error).toBe("fail");
		expect(result().loading).toBe(false);
		unmount();
	});

	it("refresh re-calls the loader", async () => {
		let callCount = 0;
		const loader: LoaderFn<TestData> = () => { callCount++; return { items: [`call-${callCount}`] }; };
		const { unmount, result } = renderLoader(loader);
		expect(callCount).toBe(1);
		result().refresh();
		await new Promise((r) => setTimeout(r, 0));
		expect(callCount).toBe(2);
		unmount();
	});
});

/**
 * lifecycle-page.tsx — Lifecycle items list page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadLifecycle } from "../loaders/lifecycle-loader.js";
import type { PageProps } from "../types.js";

function LifecyclePage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadLifecycle, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const l = item as { name: string; entityType: string; currentState: string; transitionCount: number };
		return React.createElement(Text, { bold: sel },
			`${l.name} `,
			React.createElement(Badge, { text: l.entityType, color: "blue" }),
			` ${l.currentState} (${l.transitionCount} transitions)`,
		);
	};

	const renderDetail = (item: unknown) => {
		const l = item as { name: string; entityType: string; currentState: string; transitionCount: number; createdDate: string };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, l.name),
			React.createElement(Text, null, `Entity: ${l.entityType}`),
			React.createElement(Text, null, `State: ${l.currentState}`),
			React.createElement(Text, null, `Transitions: ${l.transitionCount}`),
			React.createElement(Text, null, `Created: ${l.createdDate}`),
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
	});
}

registerPage("lifecycle", LifecyclePage);

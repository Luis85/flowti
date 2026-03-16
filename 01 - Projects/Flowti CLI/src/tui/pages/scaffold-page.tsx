/**
 * scaffold-page.tsx — Scaffold definitions list.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadScaffold } from "../loaders/scaffold-loader.js";
import type { PageProps } from "../types.js";

function ScaffoldPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadScaffold, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const d = item as { id: string; label: string; description: string };
		return React.createElement(Text, { bold: sel }, `${d.label} \u2014 ${d.description}`);
	};

	return React.createElement(ListPage, {
		items: data.definitions as readonly unknown[],
		renderItem,
	});
}

registerPage("scaffold", ScaffoldPage);

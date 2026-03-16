/**
 * make-page.tsx — Available make templates.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadMake } from "../loaders/make-loader.js";
import type { PageProps } from "../types.js";

function MakePage({ params, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadMake, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const t = item as string;
		return React.createElement(Text, { bold: sel }, t);
	};

	return React.createElement(ListPage, {
		items: data.templates as readonly unknown[],
		renderItem,
		enabled,
	});
}

registerPage("make", MakePage);

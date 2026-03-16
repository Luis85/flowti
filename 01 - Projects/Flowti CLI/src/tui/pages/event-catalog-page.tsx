/**
 * event-catalog-page.tsx — Event catalog list.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadEventCatalog } from "../loaders/event-catalog-loader.js";
import type { PageProps } from "../types.js";

function EventCatalogPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadEventCatalog, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const e = item as { name: string; domain: string; version: string };
		return React.createElement(Text, { bold: sel },
			`${e.name} `,
			React.createElement(Badge, { text: e.domain, color: "blue" }),
			` v${e.version}`,
		);
	};

	const renderDetail = (item: unknown) => {
		const e = item as { name: string; domain: string; version: string };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, e.name),
			React.createElement(Text, null, `Domain: ${e.domain}`),
			React.createElement(Text, null, `Version: ${e.version}`),
		);
	};

	return React.createElement(ListPage, {
		items: data.events as readonly unknown[],
		renderItem,
		renderDetail,
	});
}

registerPage("event-catalog", EventCatalogPage);

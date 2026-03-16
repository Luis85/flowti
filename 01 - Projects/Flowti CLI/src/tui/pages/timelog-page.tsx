/**
 * timelog-page.tsx — Time log entries page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadTimelog } from "../loaders/timelog-loader.js";
import type { PageProps } from "../types.js";

function TimelogPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadTimelog, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (item: unknown, _i: number, sel: boolean) => {
		const e = item as { date: string; person: string; hours: number; task: string };
		return React.createElement(Text, { bold: sel },
			`${e.date} ${e.person} ${e.hours}h \u2014 ${e.task}`,
		);
	};

	const renderDetail = (item: unknown) => {
		const e = item as { date: string; person: string; hours: number; category: string; task: string; description: string };
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, `${e.date} \u2014 ${e.person}`),
			React.createElement(Text, null, `Hours: ${e.hours}`),
			React.createElement(Text, null, `Category: ${e.category}`),
			React.createElement(Text, null, `Task: ${e.task}`),
			e.description ? React.createElement(Text, { dimColor: true }, e.description) : null,
		);
	};

	return React.createElement(ListPage, {
		items: data.items as readonly unknown[],
		renderItem,
		renderDetail,
	});
}

registerPage("timelog", TimelogPage);

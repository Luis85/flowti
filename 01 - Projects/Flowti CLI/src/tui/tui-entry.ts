/**
 * tui-entry.ts — Boots the Ink TUI application.
 *
 * Creates an Ink render instance with the App component.
 * Returns a Promise that resolves when the user exits (Ctrl+C or quit action).
 */

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

export async function runTui(): Promise<void> {
	const instance = render(React.createElement(App));
	await instance.waitUntilExit();
}

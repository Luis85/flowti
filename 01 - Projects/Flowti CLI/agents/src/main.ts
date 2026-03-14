/**
 * main.ts — ExcaliburJS engine setup and scene loading.
 *
 * Entry point for the agent dashboard. Loads agent data from the
 * server, creates the engine, and starts the agent scene.
 */

import * as ex from "excalibur";
import { loadDashboardData } from "./data-loader.js";
import { AgentScene } from "./agent-scene.js";

async function main(): Promise<void> {
	const data = await loadDashboardData();

	// Size the canvas to fit the content
	const agentCount = data.agents.length;
	const minWidth = Math.max(800, agentCount * 120 + 200);
	const minHeight = Math.max(500, Math.ceil(agentCount / 3) * 100 + 300);

	const engine = new ex.Engine({
		width: Math.min(minWidth, 1600),
		height: Math.min(minHeight, 900),
		backgroundColor: ex.Color.fromHex("#0a0a0f"),
		displayMode: ex.DisplayMode.FitScreen,
		antialiasing: true,
		suppressPlayButton: true,
	});

	const scene = new AgentScene();
	scene.setData(data);
	engine.addScene("dashboard", scene);
	engine.goToScene("dashboard");

	await engine.start();
}

main().catch((err) => {
	console.error("Dashboard failed to start:", err);
});

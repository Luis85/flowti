/**
 * E2E Chapter 6: Tool Showcase Journey
 *
 * Demonstrates every Journey Runner tool and capability in a single
 * declarative journey: command, click, input, highlight, wait, assert,
 * emit, navigate, eval, screenshot, manual, notice, theme.
 *
 * Uses vault file creation as a concrete scenario to exercise each tool.
 *
 * Driven by declarative JSON config — see journeys/tool-showcase.journey.json
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e:tool-showcase
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "tool-showcase.journey.json");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);

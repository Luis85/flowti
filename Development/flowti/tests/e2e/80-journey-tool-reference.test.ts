/**
 * E2E Chapter 8: Tool Reference Journey
 *
 * Compact demonstration of all 26 Journey Runner tools.
 * Each step covers a tool category with minimal actions.
 *
 * Driven by declarative JSON config — see journeys/tool-reference.journey
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e:tool-reference
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "tool-reference.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);

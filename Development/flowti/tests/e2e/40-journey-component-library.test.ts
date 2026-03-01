/**
 * E2E Chapter 4: Component Library Journey
 *
 * Driven by declarative JSON config — see journeys/component-library.journey.json
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e:components
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "component-library.journey.json");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);

/**
 * E2E Journey: This is a test journey
 *
 * Driven by declarative JSON — see journeys/This is a test journey.journey.json
 * for step definitions and actions.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "This is a test journey.journey.json");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);

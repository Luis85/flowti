/**
 * E2E Journey: Test Management Hub
 *
 * Driven by declarative JSON — see journeys/Test Management Hub.journey
 * for step definitions and actions.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "Test Management Hub.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);

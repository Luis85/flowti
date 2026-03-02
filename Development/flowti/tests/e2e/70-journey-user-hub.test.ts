/**
 * E2E Chapter 7: User Hub Journey
 *
 * Validates the User Hub homepage and Sessions tab with visual inspection.
 *
 * Driven by declarative JSON config — see journeys/user-hub.journey.json
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e -- --journey=user-hub
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "user-hub.journey.json");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);

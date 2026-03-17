/**
 * E2E Chapter 3: Getting Started Journey
 *
 * Driven by declarative JSON config — see journeys/getting-started.journey
 * for step definitions and actions.
 *
 * Run with: npm run test:e2e:getting-started
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "getting-started.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);
